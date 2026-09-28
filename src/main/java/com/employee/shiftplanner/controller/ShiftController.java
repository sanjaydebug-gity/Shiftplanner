package com.employee.shiftplanner.controller;

import com.employee.shiftplanner.entity.Shift;
import com.employee.shiftplanner.service.ShiftService;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

@RestController
public class ShiftController {

    private final ShiftService shiftService;

    public ShiftController(ShiftService shiftService) {
        this.shiftService = shiftService;
    }

    @PostMapping("/shifts")
    public Shift createShift(@RequestBody Shift shift) {
        return shiftService.createShift(shift);
    }

    @GetMapping("/shifts")
    public List<Shift> getAllShifts() {
        return shiftService.getAllShifts();
    }

    @GetMapping("/shifts/{id}")
    public Shift getShiftById(@PathVariable Long id) {
        return shiftService.getShiftById(id);
    }

    @PutMapping("/shifts/{id}")
    public Shift updateShift(@PathVariable Long id, @RequestBody Shift shift) {
        return shiftService.updateShift(id, shift);
    }

    @DeleteMapping("/shifts/{id}")
    public void deleteShift(@PathVariable Long id) {
        shiftService.deleteShift(id);
    }
}