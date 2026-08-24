package com.example.EPI.model;


import ch.qos.logback.core.model.processor.DependencyDefinition;
import jakarta.persistence.*;
import lombok.AllArgsConstructor;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

import java.time.LocalDate;

@Entity
@NoArgsConstructor
@AllArgsConstructor
@Getter
@Setter

public class Employee {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column (nullable = false)
    private String name;

    @Column(unique = true, nullable = false)
    private String email;

    private String phone;

    private String address;

    @ManyToOne
    @JoinColumn(name = "department_id")
    private Department department;

    private LocalDate joiningDate;

    private Double salary;


    private Boolean isActive;

}
