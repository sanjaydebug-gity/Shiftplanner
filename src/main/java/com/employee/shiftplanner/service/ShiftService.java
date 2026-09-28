package com.employee.shiftplanner.service;

import com.employee.shiftplanner.entity.Shift;
import com.employee.shiftplanner.exception.BusinessRuleViolationException;
import com.employee.shiftplanner.exception.ResourceNotFoundException;
import com.employee.shiftplanner.repository.ShiftRepository;
import org.springframework.stereotype.Service;

import java.util.List;

@Service
public class ShiftService {

    private final ShiftRepository shiftRepository;

    public ShiftService(ShiftRepository shiftRepository) {
        this.shiftRepository = shiftRepository;
    }

    public Shift createShift(Shift shift) {
        if (shift.getStartTime() == null || shift.getEndTime() == null) {
            throw new BusinessRuleViolationException("Shift start time and end time cannot be null");
        }
        if (shift.getStartTime().equals(shift.getEndTime())) {
            throw new BusinessRuleViolationException("Shift start time and end time cannot be identical");
        }
        return shiftRepository.save(shift);
    }

    public List<Shift> getAllShifts() {
        return shiftRepository.findAll();
    }

    public Shift getShiftById(Long id) {
        return shiftRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("Shift not found with ID: " + id));
    }

    public Shift updateShift(Long id, Shift updatedShift) {
        Shift existing = getShiftById(id);
        existing.setName(updatedShift.getName());
        existing.setStartTime(updatedShift.getStartTime());
        existing.setEndTime(updatedShift.getEndTime());
        return shiftRepository.save(existing);
    }

    public void deleteShift(Long id) {
        if (!shiftRepository.existsById(id)) {
            throw new ResourceNotFoundException("Shift not found with ID: " + id);
        }
        shiftRepository.deleteById(id);
    }
}