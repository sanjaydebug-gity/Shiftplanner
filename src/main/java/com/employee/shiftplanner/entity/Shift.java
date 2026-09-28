package com.employee.shiftplanner.entity;

import com.fasterxml.jackson.annotation.JsonFormat;
import jakarta.persistence.*;

import java.time.LocalTime;

@Entity
@Table(name = "shifts")
public class Shift {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false)
    private String name;

    @JsonFormat(pattern = "HH:mm:ss")
    @Column(nullable = false)
    private LocalTime startTime;

    @JsonFormat(pattern = "HH:mm:ss")
    @Column(nullable = false)
    private LocalTime endTime;

    public Shift() {
    }

    public Shift(String name, LocalTime startTime, LocalTime endTime) {
        this.name = name;
        this.startTime = startTime;
        this.endTime = endTime;
    }

    public Long getId() {
        return id;
    }

    public void setId(Long id) {
        this.id = id;
    }

    public String getName() {
        return name;
    }

    public void setName(String name) {
        this.name = name;
    }

    public LocalTime getStartTime() {
        return startTime;
    }

    public void setStartTime(LocalTime startTime) {
        this.startTime = startTime;
    }

    public LocalTime getEndTime() {
        return endTime;
    }

    public void setEndTime(LocalTime endTime) {
        this.endTime = endTime;
    }

    public boolean overlapsWith(Shift other) {
        if (other == null) return false;
        if (this.id != null && other.id != null && this.id.equals(other.id)) return true;
        return checkOverlap(this.startTime, this.endTime, other.startTime, other.endTime);
    }

    private boolean checkOverlap(LocalTime s1, LocalTime e1, LocalTime s2, LocalTime e2) {
        boolean s1CrossesMidnight = !e1.isAfter(s1);
        boolean s2CrossesMidnight = !e2.isAfter(s2);

        if (!s1CrossesMidnight && !s2CrossesMidnight) {
            return s1.isBefore(e2) && s2.isBefore(e1);
        }

        LocalTime dayEnd = LocalTime.MAX;
        LocalTime dayStart = LocalTime.MIN;

        if (s1CrossesMidnight && !s2CrossesMidnight) {
            return (s1.isBefore(e2) && s2.isBefore(dayEnd)) ||
                   (dayStart.isBefore(e2) && s2.isBefore(e1));
        }

        if (!s1CrossesMidnight && s2CrossesMidnight) {
            return (s2.isBefore(e1) && s1.isBefore(dayEnd)) ||
                   (dayStart.isBefore(e1) && s1.isBefore(e2));
        }

        return true;
    }
}