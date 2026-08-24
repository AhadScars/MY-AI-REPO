package com.example.EPI.service;


import com.example.EPI.model.Department;
import com.example.EPI.model.Employee;
import com.example.EPI.repository.EmployeeRepository;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;

import java.util.List;

@Service
public class EmployeeService {

    @Autowired
    EmployeeRepository repository;

    public List<Employee> getAll(){
        return repository.findAll();
    }

    public Employee saveEmployee(Employee employee){
        return repository.save(employee);
    }

    public Employee findByname(String name){
        return repository.findByName(name);
    }

    public List<Employee> getEmployeeByDepartment(Department department){
        return repository.findByDepartment(department);
    }

    public void DeleteAll(){
        repository.deleteAll();
    }

}
