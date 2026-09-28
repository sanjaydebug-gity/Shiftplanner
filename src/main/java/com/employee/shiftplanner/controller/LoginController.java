package com.employee.shiftplanner.controller;

import jakarta.servlet.http.HttpSession;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.HashMap;
import java.util.Map;
import java.util.UUID;

@RestController
@RequestMapping("/auth")
public class LoginController {

    @PostMapping("/login")
    public ResponseEntity<Map<String, Object>> login(@RequestBody Map<String, String> credentials, HttpSession session) {
        String username = credentials.get("username");
        String password = credentials.get("password");

        Map<String, Object> response = new HashMap<>();
        if ("admin".equals(username) && "admin123".equals(password)) {
            session.setAttribute("user", "admin");
            session.setAttribute("role", "MANAGER");
            
            response.put("success", true);
            response.put("message", "Login successful");
            response.put("username", "admin");
            response.put("role", "MANAGER");
            return ResponseEntity.ok(response);
        }

        response.put("success", false);
        response.put("message", "Invalid credentials");
        return ResponseEntity.status(HttpStatus.UNAUTHORIZED).body(response);
    }

    @GetMapping("/session")
    public ResponseEntity<Map<String, Object>> checkSession(HttpSession session) {
        Map<String, Object> response = new HashMap<>();
        Object user = session.getAttribute("user");
        
        if (user != null) {
            response.put("authenticated", true);
            response.put("username", user);
            response.put("role", session.getAttribute("role"));
            response.put("csrfToken", UUID.randomUUID().toString());
        } else {
            response.put("authenticated", false);
        }
        
        return ResponseEntity.ok(response);
    }

    @PostMapping("/logout")
    public ResponseEntity<Void> logout(HttpSession session) {
        session.invalidate();
        return ResponseEntity.ok().build();
    }
}
