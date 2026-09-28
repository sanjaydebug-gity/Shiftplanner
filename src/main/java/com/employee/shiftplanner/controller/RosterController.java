package com.employee.shiftplanner.controller;

import com.employee.shiftplanner.entity.Roster;
import com.employee.shiftplanner.service.RosterService;
import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.web.bind.annotation.*;

import java.time.LocalDate;
import java.util.List;

@RestController
public class RosterController {

    private final RosterService rosterService;

    public RosterController(RosterService rosterService) {
        this.rosterService = rosterService;
    }

    @PostMapping("/rosters")
    public Roster createRoster(@RequestBody Roster roster) {
        return rosterService.createRoster(roster);
    }

    @PostMapping("/rosters/bulk")
    public List<Roster> createBulkRoster(@RequestBody List<Roster> rosters) {
        return rosterService.createBulkRoster(rosters);
    }

    @GetMapping("/rosters")
    public List<Roster> getRosters(
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate date,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate startDate,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate endDate,
            @RequestParam(required = false) Long employeeId) {

        if (date != null) {
            return rosterService.getRostersByDate(date);
        }
        if (startDate != null && endDate != null) {
            return rosterService.getRostersByDateRange(startDate, endDate);
        }
        if (employeeId != null) {
            return rosterService.getRostersByEmployee(employeeId);
        }
        return rosterService.getAllRosters();
    }

    @GetMapping("/rosters/{id}")
    public Roster getRosterById(@PathVariable Long id) {
        return rosterService.getRosterById(id);
    }

    @DeleteMapping("/rosters/{id}")
    public void deleteRoster(@PathVariable Long id) {
        rosterService.deleteRoster(id);
    }
}