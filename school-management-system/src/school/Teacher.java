package school;

import java.util.ArrayList;
import java.util.List;

/**
 * Teacher class demonstrates INHERITANCE (extends Person)
 * and teacher-specific behavior.
 */
public class Teacher extends Person {
    private String department;
    private String specialization;
    private double salary;
    private int experienceYears;
    private List<String> assignedCourseIds;

    public Teacher(String id, String name, int age, String gender, String phone, String email,
                   String department, String specialization, double salary, int experienceYears) {
        super(id, name, age, gender, phone, email);
        this.department = department;
        this.specialization = specialization;
        this.salary = salary;
        this.experienceYears = experienceYears;
        this.assignedCourseIds = new ArrayList<>();
    }

    public String getDepartment() {
        return department;
    }

    public void setDepartment(String department) {
        this.department = department;
    }

    public String getSpecialization() {
        return specialization;
    }

    public void setSpecialization(String specialization) {
        this.specialization = specialization;
    }

    public double getSalary() {
        return salary;
    }

    public void setSalary(double salary) {
        if (salary >= 0) {
            this.salary = salary;
        }
    }

    public int getExperienceYears() {
        return experienceYears;
    }

    public void setExperienceYears(int experienceYears) {
        if (experienceYears >= 0) {
            this.experienceYears = experienceYears;
        }
    }

    public List<String> getAssignedCourseIds() {
        return new ArrayList<>(assignedCourseIds);
    }

    public void assignCourse(String courseId) {
        if (courseId != null && !assignedCourseIds.contains(courseId)) {
            assignedCourseIds.add(courseId);
        }
    }

    public void removeCourse(String courseId) {
        assignedCourseIds.remove(courseId);
    }

    public void giveRaise(double percent) {
        if (percent > 0) {
            salary += salary * (percent / 100.0);
        }
    }

    @Override
    public String getRole() {
        return "Teacher";
    }

    @Override
    public void displayDetails() {
        System.out.println("---------- TEACHER DETAILS ----------");
        displayBasicInfo();
        System.out.println("Department      : " + department);
        System.out.println("Specialization  : " + specialization);
        System.out.println("Salary          : " + salary);
        System.out.println("Experience      : " + experienceYears + " years");
        System.out.println("Assigned Courses: " + (assignedCourseIds.isEmpty()
                ? "None" : String.join(", ", assignedCourseIds)));
        System.out.println("-------------------------------------");
    }
}
