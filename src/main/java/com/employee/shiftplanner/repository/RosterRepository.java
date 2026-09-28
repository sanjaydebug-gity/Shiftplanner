package com.employee.shiftplanner.repository;

import com.employee.shiftplanner.entity.Roster;
import org.springframework.data.jpa.repository.JpaRepository;

import java.time.LocalDate;
import java.util.List;

public interface RosterRepository extends JpaRepository<Roster, Long> {
    List<Roster> findByEmployeeId(Long employeeId);
    List<Roster> findByShiftDate(LocalDate shiftDate);
    List<Roster> findByEmployeeIdAndShiftDate(Long employeeId, LocalDate shiftDate);
    List<Roster> findByShiftDateBetween(LocalDate startDate, LocalDate endDate);
}