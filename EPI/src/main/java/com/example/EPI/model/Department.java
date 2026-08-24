package com.example.EPI.model;


import jakarta.persistence.*;
import lombok.AllArgsConstructor;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

import java.util.List;

@Entity
@AllArgsConstructor
@NoArgsConstructor
@Getter
@Setter

public class Department {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Integer  Id;

    private String DepartmentName;

    @OneToMany(mappedBy = "department")
    private List<Employee> employees;

}
