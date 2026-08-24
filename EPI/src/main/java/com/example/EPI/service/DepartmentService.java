package com.example.EPI.service;


import com.example.EPI.model.Department;
import com.example.EPI.repository.DepartmentRepository;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;

import java.util.List;

@Service
public class DepartmentService {

    @Autowired
    DepartmentRepository repository;

    public List<Department> getAll(){
        return repository.findAll();
    }

    public Department saveDepartment(Department department){
        return repository.save(department);
    }

    public void deleteAllDepartment(){
        repository.deleteAll();
    }


}
