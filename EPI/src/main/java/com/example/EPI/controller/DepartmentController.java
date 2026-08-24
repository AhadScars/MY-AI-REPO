package com.example.EPI.controller;


import com.example.EPI.model.Department;
import com.example.EPI.service.DepartmentService;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/department")
public class DepartmentController {

    @Autowired
    DepartmentService service;

    @GetMapping("/get")
    public List<Department> getAll (){
        return service.getAll();
    }

    @PostMapping("/save")
    public Department saveDepartment(@RequestBody Department department){
        return service.saveDepartment(department);
    }

}
