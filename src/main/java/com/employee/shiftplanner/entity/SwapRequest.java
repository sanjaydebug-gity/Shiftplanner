package com.employee.shiftplanner.entity;

import com.fasterxml.jackson.annotation.JsonFormat;
import jakarta.persistence.*;

import java.time.LocalDateTime;

@Entity
@Table(name = "swap_requests")
public class SwapRequest {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.EAGER)
    @JoinColumn(name = "requester_roster_id", nullable = false)
    private Roster requesterRoster;

    @ManyToOne(fetch = FetchType.EAGER)
    @JoinColumn(name = "requester_id", nullable = false)
    private Employee requester;

    @ManyToOne(fetch = FetchType.EAGER)
    @JoinColumn(name = "colleague_id", nullable = false)
    private Employee colleague;

    @ManyToOne(fetch = FetchType.EAGER)
    @JoinColumn(name = "colleague_roster_id", nullable = true)
    private Roster colleagueRoster;

    private String reason;

    @Column(nullable = false)
    private String colleagueStatus = "PENDING";

    @Column(nullable = false)
    private String managerStatus = "PENDING";

    @Column(nullable = false)
    private String status = "PENDING_COLLEAGUE_APPROVAL";

    @JsonFormat(pattern = "yyyy-MM-dd HH:mm:ss")
    @Column(nullable = false)
    private LocalDateTime createdAt = LocalDateTime.now();

    public SwapRequest() {
    }

    public Long getId() {
        return id;
    }

    public void setId(Long id) {
        this.id = id;
    }

    public Roster getRequesterRoster() {
        return requesterRoster;
    }

    public void setRequesterRoster(Roster requesterRoster) {
        this.requesterRoster = requesterRoster;
    }

    public Employee getRequester() {
        return requester;
    }

    public void setRequester(Employee requester) {
        this.requester = requester;
    }

    public Employee getColleague() {
        return colleague;
    }

    public void setColleague(Employee colleague) {
        this.colleague = colleague;
    }

    public Roster getColleagueRoster() {
        return colleagueRoster;
    }

    public void setColleagueRoster(Roster colleagueRoster) {
        this.colleagueRoster = colleagueRoster;
    }

    public String getReason() {
        return reason;
    }

    public void setReason(String reason) {
        this.reason = reason;
    }

    public String getColleagueStatus() {
        return colleagueStatus;
    }

    public void setColleagueStatus(String colleagueStatus) {
        this.colleagueStatus = colleagueStatus;
    }

    public String getManagerStatus() {
        return managerStatus;
    }

    public void setManagerStatus(String managerStatus) {
        this.managerStatus = managerStatus;
    }

    public String getStatus() {
        return status;
    }

    public void setStatus(String status) {
        this.status = status;
    }

    public LocalDateTime getCreatedAt() {
        return createdAt;
    }

    public void setCreatedAt(LocalDateTime createdAt) {
        this.createdAt = createdAt;
    }
}