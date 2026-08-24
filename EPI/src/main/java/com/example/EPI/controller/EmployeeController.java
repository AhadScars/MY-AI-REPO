package com.example.EPI.controller;


import com.example.EPI.model.Department;
import com.example.EPI.model.Employee;
import com.example.EPI.service.EmployeeService;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/employee")
public class EmployeeController {

    @Autowired
    EmployeeService service;

    @GetMapping("/get")
    public ResponseEntity<?> getAll(){
        List<Employee> user = service.getAll();

        if (user.isEmpty()){
            return new ResponseEntity<>("List is Empty", HttpStatus.NO_CONTENT);
        }
        return new ResponseEntity<>(user,HttpStatus.OK);
    }

    @PostMapping("/save")
    public Employee saveEmployee(@RequestBody Employee employee){
        return service.saveEmployee(employee);
    }

    @GetMapping("/find/{name}")
    public Employee findByname(@PathVariable String name){
        return service.findByname(name);
    }


    @DeleteMapping("/delete")
    public void DeleteAll(){
        service.DeleteAll();
    }

    @GetMapping("/department/{department}")
    public List<Employee>  getEmployeesByDepartment(@PathVariable Department department){
        return service.getEmployeeByDepartment(department);
    }
}
