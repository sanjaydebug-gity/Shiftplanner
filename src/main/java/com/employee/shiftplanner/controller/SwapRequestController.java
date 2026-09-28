package com.employee.shiftplanner.controller;

import com.employee.shiftplanner.entity.SwapRequest;
import com.employee.shiftplanner.service.SwapRequestService;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;

@RestController
public class SwapRequestController {

    private final SwapRequestService swapRequestService;

    public SwapRequestController(SwapRequestService swapRequestService) {
        this.swapRequestService = swapRequestService;
    }

    @PostMapping("/swap-requests")
    public SwapRequest createSwapRequest(@RequestBody SwapRequest swapRequest) {
        return swapRequestService.createSwapRequest(swapRequest);
    }

    @PutMapping("/swap-requests/{id}/colleague-decision")
    public SwapRequest colleagueDecision(
            @PathVariable Long id,
            @RequestParam(required = false) Long colleagueId,
            @RequestParam(required = false) String decision,
            @RequestBody(required = false) Map<String, Object> body) {

        Long colId = colleagueId != null ? colleagueId :
                (body != null && body.get("colleagueId") != null ? Long.valueOf(body.get("colleagueId").toString()) : null);

        String dec = decision != null ? decision :
                (body != null && body.get("decision") != null ? body.get("decision").toString() : null);

        return swapRequestService.processColleagueDecision(id, colId, dec);
    }

    @PutMapping("/swap-requests/{id}/manager-decision")
    public SwapRequest managerDecision(
            @PathVariable Long id,
            @RequestParam(required = false) Long managerId,
            @RequestParam(required = false) String decision,
            @RequestBody(required = false) Map<String, Object> body) {

        Long mgrId = managerId != null ? managerId :
                (body != null && body.get("managerId") != null ? Long.valueOf(body.get("managerId").toString()) : null);

        String dec = decision != null ? decision :
                (body != null && body.get("decision") != null ? body.get("decision").toString() : null);

        return swapRequestService.processManagerDecision(id, mgrId, dec);
    }

    @GetMapping("/swap-requests")
    public List<SwapRequest> getSwapRequests(
            @RequestParam(required = false) String status,
            @RequestParam(required = false) Long requesterId,
            @RequestParam(required = false) Long colleagueId) {

        if (status != null && !status.isEmpty()) {
            return swapRequestService.getSwapRequestsByStatus(status);
        }
        if (requesterId != null) {
            return swapRequestService.getSwapRequestsByRequester(requesterId);
        }
        if (colleagueId != null) {
            return swapRequestService.getSwapRequestsByColleague(colleagueId);
        }
        return swapRequestService.getAllSwapRequests();
    }

    @GetMapping("/swap-requests/{id}")
    public SwapRequest getSwapRequestById(@PathVariable Long id) {
        return swapRequestService.getSwapRequestById(id);
    }
}