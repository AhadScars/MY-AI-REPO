package school;

import java.util.ArrayList;
import java.util.List;

/**
 * Student class demonstrates INHERITANCE (extends Person)
 * and ENCAPSULATION of student-specific data.
 */
public class Student extends Person {
    private String grade;           // e.g. "10", "12"
    private String section;         // e.g. "A", "B"
    private String parentName;
    private double feesPaid;
    private double totalFees;
    private List<String> enrolledCourseIds;

    public Student(String id, String name, int age, String gender, String phone, String email,
                   String grade, String section, String parentName, double totalFees) {
        super(id, name, age, gender, phone, email);
        this.grade = grade;
        this.section = section;
        this.parentName = parentName;
        this.totalFees = totalFees;
        this.feesPaid = 0.0;
        this.enrolledCourseIds = new ArrayList<>();
    }

    public String getGrade() {
        return grade;
    }

    public void setGrade(String grade) {
        this.grade = grade;
    }

    public String getSection() {
        return section;
    }

    public void setSection(String section) {
        this.section = section;
    }

    public String getParentName() {
        return parentName;
    }

    public void setParentName(String parentName) {
        this.parentName = parentName;
    }

    public double getFeesPaid() {
        return feesPaid;
    }

    public double getTotalFees() {
        return totalFees;
    }

    public void setTotalFees(double totalFees) {
        if (totalFees >= 0) {
            this.totalFees = totalFees;
        }
    }

    public List<String> getEnrolledCourseIds() {
        return new ArrayList<>(enrolledCourseIds); // defensive copy
    }

    public void enrollCourse(String courseId) {
        if (courseId != null && !enrolledCourseIds.contains(courseId)) {
            enrolledCourseIds.add(courseId);
        }
    }

    public void unenrollCourse(String courseId) {
        enrolledCourseIds.remove(courseId);
    }

    public void payFees(double amount) {
        if (amount > 0) {
            feesPaid += amount;
            if (feesPaid > totalFees) {
                feesPaid = totalFees;
            }
        }
    }

    public double getPendingFees() {
        return Math.max(0, totalFees - feesPaid);
    }

    public boolean isFeesCleared() {
        return feesPaid >= totalFees;
    }

    @Override
    public String getRole() {
        return "Student";
    }

    @Override
    public void displayDetails() {
        System.out.println("---------- STUDENT DETAILS ----------");
        displayBasicInfo();
        System.out.println("Grade       : " + grade);
        System.out.println("Section     : " + section);
        System.out.println("Parent      : " + parentName);
        System.out.println("Total Fees  : " + totalFees);
        System.out.println("Fees Paid   : " + feesPaid);
        System.out.println("Pending     : " + getPendingFees());
        System.out.println("Courses     : " + (enrolledCourseIds.isEmpty()
                ? "None" : String.join(", ", enrolledCourseIds)));
        System.out.println("-------------------------------------");
    }
}
