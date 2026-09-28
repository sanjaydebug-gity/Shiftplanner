package com.employee.shiftplanner.repository;

import com.employee.shiftplanner.entity.SwapRequest;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

public interface SwapRequestRepository extends JpaRepository<SwapRequest, Long> {
    List<SwapRequest> findByRequesterId(Long requesterId);
    List<SwapRequest> findByColleagueId(Long colleagueId);
    List<SwapRequest> findByStatus(String status);
}