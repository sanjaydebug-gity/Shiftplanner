package com.employee.shiftplanner.service;

import com.employee.shiftplanner.entity.Employee;
import com.employee.shiftplanner.entity.Roster;
import com.employee.shiftplanner.entity.Shift;
import com.employee.shiftplanner.exception.BusinessRuleViolationException;
import com.employee.shiftplanner.exception.ResourceNotFoundException;
import com.employee.shiftplanner.repository.EmployeeRepository;
import com.employee.shiftplanner.repository.RosterRepository;
import com.employee.shiftplanner.repository.ShiftRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDate;
import java.util.ArrayList;
import java.util.List;

@Service
public class RosterService {

    private final RosterRepository rosterRepository;
    private final EmployeeRepository employeeRepository;
    private final ShiftRepository shiftRepository;

    public RosterService(RosterRepository rosterRepository,
                         EmployeeRepository employeeRepository,
                         ShiftRepository shiftRepository) {
        this.rosterRepository = rosterRepository;
        this.employeeRepository = employeeRepository;
        this.shiftRepository = shiftRepository;
    }

    public void validateNoOverlappingShift(Long employeeId, LocalDate shiftDate, Shift newShift, Long excludeRosterId) {
        List<Roster> existingRosters = rosterRepository.findByEmployeeIdAndShiftDate(employeeId, shiftDate);
        for (Roster existing : existingRosters) {
            if ("CANCELLED".equalsIgnoreCase(existing.getStatus())) {
                continue;
            }
            if (excludeRosterId != null && existing.getId().equals(excludeRosterId)) {
                continue;
            }
            if (existing.getShift().overlapsWith(newShift)) {
                throw new BusinessRuleViolationException(
                        "Overlapping shift detected: Employee ID " + employeeId + " is already assigned to '" +
                        existing.getShift().getName() + "' (" + existing.getShift().getStartTime() + " - " +
                        existing.getShift().getEndTime() + ") on " + shiftDate + ". Cannot assign overlapping shift '" +
                        newShift.getName() + "' (" + newShift.getStartTime() + " - " + newShift.getEndTime() + ")."
                );
            }
        }
    }

    @Transactional
    public Roster createRoster(Roster roster) {
        if (roster.getEmployee() == null || roster.getEmployee().getId() == null) {
            throw new BusinessRuleViolationException("Employee ID is required");
        }
        if (roster.getShift() == null || roster.getShift().getId() == null) {
            throw new BusinessRuleViolationException("Shift ID is required");
        }
        if (roster.getShiftDate() == null) {
            throw new BusinessRuleViolationException("Shift date is required (format: YYYY-MM-DD)");
        }

        Employee employee = employeeRepository.findById(roster.getEmployee().getId())
                .orElseThrow(() -> new ResourceNotFoundException("Employee not found with ID: " + roster.getEmployee().getId()));

        Shift shift = shiftRepository.findById(roster.getShift().getId())
                .orElseThrow(() -> new ResourceNotFoundException("Shift not found with ID: " + roster.getShift().getId()));

        validateNoOverlappingShift(employee.getId(), roster.getShiftDate(), shift, null);

        roster.setEmployee(employee);
        roster.setShift(shift);
        if (roster.getStatus() == null || roster.getStatus().trim().isEmpty()) {
            roster.setStatus("SCHEDULED");
        }

        System.out.println("[NOTIFICATION] Roster created: Assigned Employee " + employee.getName() +
                " to Shift '" + shift.getName() + "' on " + roster.getShiftDate());
        return rosterRepository.save(roster);
    }

    @Transactional
    public List<Roster> createBulkRoster(List<Roster> rosters) {
        List<Roster> createdRosters = new ArrayList<>();
        for (Roster r : rosters) {
            createdRosters.add(createRoster(r));
        }
        return createdRosters;
    }

    public List<Roster> getAllRosters() {
        return rosterRepository.findAll();
    }

    public Roster getRosterById(Long id) {
        return rosterRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("Roster not found with ID: " + id));
    }

    public List<Roster> getRostersByDate(LocalDate date) {
        return rosterRepository.findByShiftDate(date);
    }

    public List<Roster> getRostersByDateRange(LocalDate start, LocalDate end) {
        return rosterRepository.findByShiftDateBetween(start, end);
    }

    public List<Roster> getRostersByEmployee(Long employeeId) {
        return rosterRepository.findByEmployeeId(employeeId);
    }

    public void deleteRoster(Long id) {
        if (!rosterRepository.existsById(id)) {
            throw new ResourceNotFoundException("Roster not found with ID: " + id);
        }
        rosterRepository.deleteById(id);
    }
}