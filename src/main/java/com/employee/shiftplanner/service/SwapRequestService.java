package com.employee.shiftplanner.service;

import com.employee.shiftplanner.entity.Employee;
import com.employee.shiftplanner.entity.Roster;
import com.employee.shiftplanner.entity.SwapRequest;
import com.employee.shiftplanner.exception.BusinessRuleViolationException;
import com.employee.shiftplanner.exception.ResourceNotFoundException;
import com.employee.shiftplanner.repository.EmployeeRepository;
import com.employee.shiftplanner.repository.RosterRepository;
import com.employee.shiftplanner.repository.SwapRequestRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.List;

@Service
public class SwapRequestService {

    private final SwapRequestRepository swapRequestRepository;
    private final RosterRepository rosterRepository;
    private final EmployeeRepository employeeRepository;
    private final RosterService rosterService;

    public SwapRequestService(SwapRequestRepository swapRequestRepository,
                              RosterRepository rosterRepository,
                              EmployeeRepository employeeRepository,
                              RosterService rosterService) {
        this.swapRequestRepository = swapRequestRepository;
        this.rosterRepository = rosterRepository;
        this.employeeRepository = employeeRepository;
        this.rosterService = rosterService;
    }

    @Transactional
    public SwapRequest createSwapRequest(SwapRequest swapRequest) {
        if (swapRequest.getRequester() == null || swapRequest.getRequester().getId() == null) {
            throw new BusinessRuleViolationException("Requester Employee ID is required");
        }
        if (swapRequest.getColleague() == null || swapRequest.getColleague().getId() == null) {
            throw new BusinessRuleViolationException("Colleague Employee ID is required");
        }
        if (swapRequest.getRequesterRoster() == null || swapRequest.getRequesterRoster().getId() == null) {
            throw new BusinessRuleViolationException("Requester Roster ID is required");
        }

        Employee requester = employeeRepository.findById(swapRequest.getRequester().getId())
                .orElseThrow(() -> new ResourceNotFoundException("Requester employee not found with ID: " + swapRequest.getRequester().getId()));

        Employee colleague = employeeRepository.findById(swapRequest.getColleague().getId())
                .orElseThrow(() -> new ResourceNotFoundException("Colleague employee not found with ID: " + swapRequest.getColleague().getId()));

        if (requester.getId().equals(colleague.getId())) {
            throw new BusinessRuleViolationException("Cannot request a shift swap with yourself.");
        }

        Roster requesterRoster = rosterRepository.findById(swapRequest.getRequesterRoster().getId())
                .orElseThrow(() -> new ResourceNotFoundException("Requester roster entry not found with ID: " + swapRequest.getRequesterRoster().getId()));

        if (!requesterRoster.getEmployee().getId().equals(requester.getId())) {
            throw new BusinessRuleViolationException("Requester " + requester.getName() + " is not assigned to roster ID: " + requesterRoster.getId());
        }

        Roster colleagueRoster = null;
        if (swapRequest.getColleagueRoster() != null && swapRequest.getColleagueRoster().getId() != null) {
            colleagueRoster = rosterRepository.findById(swapRequest.getColleagueRoster().getId())
                    .orElseThrow(() -> new ResourceNotFoundException("Colleague roster entry not found with ID: " + swapRequest.getColleagueRoster().getId()));

            if (!colleagueRoster.getEmployee().getId().equals(colleague.getId())) {
                throw new BusinessRuleViolationException("Colleague " + colleague.getName() + " is not assigned to roster ID: " + colleagueRoster.getId());
            }
        }

        rosterService.validateNoOverlappingShift(
                colleague.getId(),
                requesterRoster.getShiftDate(),
                requesterRoster.getShift(),
                (colleagueRoster != null ? colleagueRoster.getId() : null)
        );

        if (colleagueRoster != null) {
            rosterService.validateNoOverlappingShift(
                    requester.getId(),
                    colleagueRoster.getShiftDate(),
                    colleagueRoster.getShift(),
                    requesterRoster.getId()
            );
        }

        swapRequest.setRequester(requester);
        swapRequest.setColleague(colleague);
        swapRequest.setRequesterRoster(requesterRoster);
        swapRequest.setColleagueRoster(colleagueRoster);
        swapRequest.setColleagueStatus("PENDING");
        swapRequest.setManagerStatus("PENDING");
        swapRequest.setStatus("PENDING_COLLEAGUE_APPROVAL");
        swapRequest.setCreatedAt(LocalDateTime.now());

        SwapRequest saved = swapRequestRepository.save(swapRequest);
        System.out.println("[NOTIFICATION] Swap request #" + saved.getId() + " created by " +
                requester.getName() + " requesting colleague " + colleague.getName() +
                " for shift on " + requesterRoster.getShiftDate() + ". Status: PENDING_COLLEAGUE_APPROVAL");
        return saved;
    }

    @Transactional
    public SwapRequest processColleagueDecision(Long swapRequestId, Long colleagueId, String decision) {
        if (colleagueId == null) {
            throw new BusinessRuleViolationException("Colleague ID is required");
        }
        if (decision == null || decision.trim().isEmpty()) {
            throw new BusinessRuleViolationException("Decision is required ('ACCEPT' or 'DECLINE')");
        }

        SwapRequest swapRequest = swapRequestRepository.findById(swapRequestId)
                .orElseThrow(() -> new ResourceNotFoundException("Swap request not found with ID: " + swapRequestId));

        if (!swapRequest.getColleague().getId().equals(colleagueId)) {
            throw new BusinessRuleViolationException("Only the designated colleague (Employee ID: " +
                    swapRequest.getColleague().getId() + ") can respond to this swap request.");
        }

        if (!"PENDING".equalsIgnoreCase(swapRequest.getColleagueStatus())) {
            throw new BusinessRuleViolationException("Colleague has already responded (" +
                    swapRequest.getColleagueStatus() + ") to swap request ID: " + swapRequestId);
        }

        String normalizedDecision = decision.trim().toUpperCase();
        if ("ACCEPT".equals(normalizedDecision) || "ACCEPTED".equals(normalizedDecision)) {
            swapRequest.setColleagueStatus("ACCEPTED");
            swapRequest.setStatus("PENDING_MANAGER_APPROVAL");
            System.out.println("[NOTIFICATION] Colleague " + swapRequest.getColleague().getName() +
                    " ACCEPTED swap request #" + swapRequestId + ". Now waiting for Manager final approval.");
        } else if ("DECLINE".equals(normalizedDecision) || "DECLINED".equals(normalizedDecision) || "REJECT".equals(normalizedDecision)) {
            swapRequest.setColleagueStatus("DECLINED");
            swapRequest.setStatus("REJECTED_BY_COLLEAGUE");
            System.out.println("[NOTIFICATION] Colleague " + swapRequest.getColleague().getName() +
                    " DECLINED swap request #" + swapRequestId + ". Swap request rejected.");
        } else {
            throw new BusinessRuleViolationException("Invalid decision: '" + decision +
                    "'. Permitted values are 'ACCEPT' or 'DECLINE'.");
        }

        return swapRequestRepository.save(swapRequest);
    }

    @Transactional
    public SwapRequest processManagerDecision(Long swapRequestId, Long managerId, String decision) {
        if (managerId == null) {
            throw new BusinessRuleViolationException("Manager ID is required");
        }
        if (decision == null || decision.trim().isEmpty()) {
            throw new BusinessRuleViolationException("Decision is required ('APPROVE' or 'REJECT')");
        }

        Employee manager = employeeRepository.findById(managerId)
                .orElseThrow(() -> new ResourceNotFoundException("Manager employee not found with ID: " + managerId));

        if (!"MANAGER".equalsIgnoreCase(manager.getRole())) {
            throw new BusinessRuleViolationException("Employee ID " + managerId +
                    " is not authorized as a MANAGER (Current role: " + manager.getRole() + ").");
        }

        SwapRequest swapRequest = swapRequestRepository.findById(swapRequestId)
                .orElseThrow(() -> new ResourceNotFoundException("Swap request not found with ID: " + swapRequestId));

        if (!"ACCEPTED".equalsIgnoreCase(swapRequest.getColleagueStatus())) {
            throw new BusinessRuleViolationException(
                    "Business Rule Violation: A swap only takes effect once both the colleague and the manager approve it. " +
                    "Colleague has not accepted this request yet (Current Colleague Status: " +
                    swapRequest.getColleagueStatus() + ")."
            );
        }

        if (!"PENDING".equalsIgnoreCase(swapRequest.getManagerStatus())) {
            throw new BusinessRuleViolationException("Manager has already responded (" +
                    swapRequest.getManagerStatus() + ") to swap request ID: " + swapRequestId);
        }

        String normalizedDecision = decision.trim().toUpperCase();
        if ("APPROVE".equals(normalizedDecision) || "APPROVED".equals(normalizedDecision)) {
            rosterService.validateNoOverlappingShift(
                    swapRequest.getColleague().getId(),
                    swapRequest.getRequesterRoster().getShiftDate(),
                    swapRequest.getRequesterRoster().getShift(),
                    (swapRequest.getColleagueRoster() != null ? swapRequest.getColleagueRoster().getId() : null)
            );

            if (swapRequest.getColleagueRoster() != null) {
                rosterService.validateNoOverlappingShift(
                        swapRequest.getRequester().getId(),
                        swapRequest.getColleagueRoster().getShiftDate(),
                        swapRequest.getColleagueRoster().getShift(),
                        swapRequest.getRequesterRoster().getId()
                );
            }

            Roster requesterRoster = swapRequest.getRequesterRoster();
            Employee originalRequester = requesterRoster.getEmployee();
            Employee colleague = swapRequest.getColleague();

            requesterRoster.setEmployee(colleague);
            requesterRoster.setStatus("SWAPPED");
            rosterRepository.save(requesterRoster);

            if (swapRequest.getColleagueRoster() != null) {
                Roster colleagueRoster = swapRequest.getColleagueRoster();
                colleagueRoster.setEmployee(originalRequester);
                colleagueRoster.setStatus("SWAPPED");
                rosterRepository.save(colleagueRoster);
            }

            swapRequest.setManagerStatus("APPROVED");
            swapRequest.setStatus("APPROVED");

            System.out.println("[NOTIFICATION] Swap request #" + swapRequestId + " APPROVED by Manager " +
                    manager.getName() + "! Roster updated: Shift on " + requesterRoster.getShiftDate() +
                    " reassigned to " + colleague.getName() + ".");
        } else if ("REJECT".equals(normalizedDecision) || "REJECTED".equals(normalizedDecision)) {
            swapRequest.setManagerStatus("REJECTED");
            swapRequest.setStatus("REJECTED_BY_MANAGER");
            System.out.println("[NOTIFICATION] Swap request #" + swapRequestId + " REJECTED by Manager " +
                    manager.getName() + ".");
        } else {
            throw new BusinessRuleViolationException("Invalid decision: '" + decision +
                    "'. Permitted values are 'APPROVE' or 'REJECT'.");
        }

        return swapRequestRepository.save(swapRequest);
    }

    public List<SwapRequest> getAllSwapRequests() {
        return swapRequestRepository.findAll();
    }

    public SwapRequest getSwapRequestById(Long id) {
        return swapRequestRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("Swap request not found with ID: " + id));
    }

    public List<SwapRequest> getSwapRequestsByRequester(Long requesterId) {
        return swapRequestRepository.findByRequesterId(requesterId);
    }

    public List<SwapRequest> getSwapRequestsByColleague(Long colleagueId) {
        return swapRequestRepository.findByColleagueId(colleagueId);
    }

    public List<SwapRequest> getSwapRequestsByStatus(String status) {
        return swapRequestRepository.findByStatus(status);
    }
}