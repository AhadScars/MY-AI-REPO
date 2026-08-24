package com.example.EPI.repository;


import com.example.EPI.model.Department;
import com.example.EPI.model.Employee;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface EmployeeRepository extends JpaRepository <Employee,Integer> {

    Employee findByName(String employee);
    List<Employee> findByDepartment(Department department);

}
