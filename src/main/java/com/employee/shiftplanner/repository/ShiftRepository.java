package com.employee.shiftplanner.repository;

import com.employee.shiftplanner.entity.Shift;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.Optional;

public interface ShiftRepository extends JpaRepository<Shift, Long> {
    Optional<Shift> findByName(String name);
}