package school;

import java.util.*;
import java.util.Scanner;

/**
 * Console-based School Management System.
 * Demonstrates OOP: Abstraction, Encapsulation, Inheritance, Polymorphism, Composition.
 */
public class SchoolManagementSystem {
    private final School school;
    private final Scanner scanner;

    public SchoolManagementSystem(School school) {
        this.school = school;
        this.scanner = new Scanner(System.in);
    }

    public static void main(String[] args) {
        School school = new School("Green Valley Public School", "123 Education Lane, City");
        school.loadSampleData();

        SchoolManagementSystem app = new SchoolManagementSystem(school);
        app.run();
    }

    public void run() {
        printBanner();
        boolean running = true;
        while (running) {
            printMainMenu();
            int choice = readInt("Enter choice: ");
            System.out.println();
            switch (choice) {
                case 1 -> studentMenu();
                case 2 -> teacherMenu();
                case 3 -> staffMenu();
                case 4 -> courseMenu();
                case 5 -> enrollmentMenu();
                case 6 -> searchPerson();
                case 7 -> school.displayAllPeople();
                case 8 -> school.showSummary();
                case 9 -> {
                    System.out.println("Thank you for using School Management System. Goodbye!");
                    running = false;
                }
                default -> System.out.println("Invalid choice. Please try again.");
            }
        }
        scanner.close();
    }

    private void printBanner() {
        System.out.println("====================================================");
        System.out.println("     SCHOOL MANAGEMENT SYSTEM (Core Java + OOPS)    ");
        System.out.println("     " + school.getSchoolName());
        System.out.println("====================================================");
        System.out.println("Sample data loaded. You can explore or add new data.");
    }

    private void printMainMenu() {
        System.out.println("\n--------------- MAIN MENU ---------------");
        System.out.println("1. Student Management");
        System.out.println("2. Teacher Management");
        System.out.println("3. Staff Management");
        System.out.println("4. Course Management");
        System.out.println("5. Enrollment / Assignments");
        System.out.println("6. Search Person by ID (Polymorphism)");
        System.out.println("7. Display All People");
        System.out.println("8. School Summary Report");
        System.out.println("9. Exit");
        System.out.println("-----------------------------------------");
    }

    // ==================== STUDENT ====================

    private void studentMenu() {
        boolean back = false;
        while (!back) {
            System.out.println("\n--- Student Management ---");
            System.out.println("1. Add Student");
            System.out.println("2. View All Students");
            System.out.println("3. Search Student by ID");
            System.out.println("4. Remove Student");
            System.out.println("5. Pay Fees");
            System.out.println("6. Students by Grade");
            System.out.println("7. Back to Main Menu");
            int choice = readInt("Enter choice: ");
            System.out.println();
            switch (choice) {
                case 1 -> addStudent();
                case 2 -> viewAllStudents();
                case 3 -> searchStudent();
                case 4 -> removeStudent();
                case 5 -> payStudentFees();
                case 6 -> studentsByGrade();
                case 7 -> back = true;
                default -> System.out.println("Invalid choice.");
            }
        }
    }

    private void addStudent() {
        System.out.println("Add New Student");
        String id = readLine("Student ID: ");
        if (school.findStudentById(id) != null) {
            System.out.println("Student ID already exists.");
            return;
        }
        String name = readLine("Name: ");
        int age = readInt("Age: ");
        String gender = readLine("Gender: ");
        String phone = readLine("Phone: ");
        String email = readLine("Email: ");
        String grade = readLine("Grade (e.g. 10): ");
        String section = readLine("Section (e.g. A): ");
        String parent = readLine("Parent Name: ");
        double fees = readDouble("Total Fees: ");

        Student student = new Student(id, name, age, gender, phone, email, grade, section, parent, fees);
        if (school.addStudent(student)) {
            System.out.println("Student added successfully!");
        } else {
            System.out.println("Failed to add student.");
        }
    }

    private void viewAllStudents() {
        List<Student> list = school.getAllStudents();
        if (list.isEmpty()) {
            System.out.println("No students found.");
            return;
        }
        System.out.printf("%-8s %-20s %-6s %-8s %-10s %-12s%n",
                "ID", "Name", "Grade", "Section", "Fees Paid", "Pending");
        System.out.println("------------------------------------------------------------------------");
        for (Student s : list) {
            System.out.printf("%-8s %-20s %-6s %-8s %-10.2f %-12.2f%n",
                    s.getId(), s.getName(), s.getGrade(), s.getSection(),
                    s.getFeesPaid(), s.getPendingFees());
        }
    }

    private void searchStudent() {
        String id = readLine("Enter Student ID: ");
        Student s = school.findStudentById(id);
        if (s == null) {
            System.out.println("Student not found.");
        } else {
            s.displayDetails();
        }
    }

    private void removeStudent() {
        String id = readLine("Enter Student ID to remove: ");
        if (school.removeStudent(id)) {
            System.out.println("Student removed successfully.");
        } else {
            System.out.println("Student not found.");
        }
    }

    private void payStudentFees() {
        String id = readLine("Enter Student ID: ");
        Student s = school.findStudentById(id);
        if (s == null) {
            System.out.println("Student not found.");
            return;
        }
        System.out.println("Pending fees: " + s.getPendingFees());
        double amount = readDouble("Amount to pay: ");
        s.payFees(amount);
        System.out.println("Payment recorded. New pending: " + s.getPendingFees());
    }

    private void studentsByGrade() {
        String grade = readLine("Enter Grade: ");
        List<Student> list = school.getStudentsByGrade(grade);
        if (list.isEmpty()) {
            System.out.println("No students in grade " + grade);
            return;
        }
        for (Student s : list) {
            System.out.println(s.getId() + " | " + s.getName() + " | Sec " + s.getSection());
        }
    }

    // ==================== TEACHER ====================

    private void teacherMenu() {
        boolean back = false;
        while (!back) {
            System.out.println("\n--- Teacher Management ---");
            System.out.println("1. Add Teacher");
            System.out.println("2. View All Teachers");
            System.out.println("3. Search Teacher by ID");
            System.out.println("4. Remove Teacher");
            System.out.println("5. Give Raise");
            System.out.println("6. Back to Main Menu");
            int choice = readInt("Enter choice: ");
            System.out.println();
            switch (choice) {
                case 1 -> addTeacher();
                case 2 -> viewAllTeachers();
                case 3 -> searchTeacher();
                case 4 -> removeTeacher();
                case 5 -> giveRaise();
                case 6 -> back = true;
                default -> System.out.println("Invalid choice.");
            }
        }
    }

    private void addTeacher() {
        System.out.println("Add New Teacher");
        String id = readLine("Teacher ID: ");
        if (school.findTeacherById(id) != null) {
            System.out.println("Teacher ID already exists.");
            return;
        }
        String name = readLine("Name: ");
        int age = readInt("Age: ");
        String gender = readLine("Gender: ");
        String phone = readLine("Phone: ");
        String email = readLine("Email: ");
        String dept = readLine("Department: ");
        String spec = readLine("Specialization: ");
        double salary = readDouble("Salary: ");
        int exp = readInt("Experience (years): ");

        Teacher teacher = new Teacher(id, name, age, gender, phone, email, dept, spec, salary, exp);
        if (school.addTeacher(teacher)) {
            System.out.println("Teacher added successfully!");
        } else {
            System.out.println("Failed to add teacher.");
        }
    }

    private void viewAllTeachers() {
        List<Teacher> list = school.getAllTeachers();
        if (list.isEmpty()) {
            System.out.println("No teachers found.");
            return;
        }
        System.out.printf("%-8s %-20s %-15s %-12s %-10s%n",
                "ID", "Name", "Department", "Experience", "Salary");
        System.out.println("-------------------------------------------------------------------");
        for (Teacher t : list) {
            System.out.printf("%-8s %-20s %-15s %-12d %-10.2f%n",
                    t.getId(), t.getName(), t.getDepartment(),
                    t.getExperienceYears(), t.getSalary());
        }
    }

    private void searchTeacher() {
        String id = readLine("Enter Teacher ID: ");
        Teacher t = school.findTeacherById(id);
        if (t == null) {
            System.out.println("Teacher not found.");
        } else {
            t.displayDetails();
        }
    }

    private void removeTeacher() {
        String id = readLine("Enter Teacher ID to remove: ");
        if (school.removeTeacher(id)) {
            System.out.println("Teacher removed successfully.");
        } else {
            System.out.println("Teacher not found.");
        }
    }

    private void giveRaise() {
        String id = readLine("Enter Teacher ID: ");
        Teacher t = school.findTeacherById(id);
        if (t == null) {
            System.out.println("Teacher not found.");
            return;
        }
        double percent = readDouble("Raise percentage: ");
        t.giveRaise(percent);
        System.out.println("New salary: " + t.getSalary());
    }

    // ==================== STAFF ====================

    private void staffMenu() {
        boolean back = false;
        while (!back) {
            System.out.println("\n--- Staff Management ---");
            System.out.println("1. Add Staff");
            System.out.println("2. View All Staff");
            System.out.println("3. Search Staff by ID");
            System.out.println("4. Remove Staff");
            System.out.println("5. Back to Main Menu");
            int choice = readInt("Enter choice: ");
            System.out.println();
            switch (choice) {
                case 1 -> addStaff();
                case 2 -> viewAllStaff();
                case 3 -> searchStaff();
                case 4 -> removeStaff();
                case 5 -> back = true;
                default -> System.out.println("Invalid choice.");
            }
        }
    }

    private void addStaff() {
        System.out.println("Add New Staff");
        String id = readLine("Staff ID: ");
        if (school.findStaffById(id) != null) {
            System.out.println("Staff ID already exists.");
            return;
        }
        String name = readLine("Name: ");
        int age = readInt("Age: ");
        String gender = readLine("Gender: ");
        String phone = readLine("Phone: ");
        String email = readLine("Email: ");
        String designation = readLine("Designation: ");
        String dept = readLine("Department: ");
        double salary = readDouble("Salary: ");
        String shift = readLine("Shift (Morning/Evening): ");

        Staff staff = new Staff(id, name, age, gender, phone, email, designation, dept, salary, shift);
        if (school.addStaff(staff)) {
            System.out.println("Staff added successfully!");
        } else {
            System.out.println("Failed to add staff.");
        }
    }

    private void viewAllStaff() {
        List<Staff> list = school.getAllStaff();
        if (list.isEmpty()) {
            System.out.println("No staff found.");
            return;
        }
        System.out.printf("%-8s %-20s %-15s %-12s %-10s%n",
                "ID", "Name", "Designation", "Department", "Salary");
        System.out.println("-------------------------------------------------------------------");
        for (Staff s : list) {
            System.out.printf("%-8s %-20s %-15s %-12s %-10.2f%n",
                    s.getId(), s.getName(), s.getDesignation(),
                    s.getDepartment(), s.getSalary());
        }
    }

    private void searchStaff() {
        String id = readLine("Enter Staff ID: ");
        Staff s = school.findStaffById(id);
        if (s == null) {
            System.out.println("Staff not found.");
        } else {
            s.displayDetails();
        }
    }

    private void removeStaff() {
        String id = readLine("Enter Staff ID to remove: ");
        if (school.removeStaff(id)) {
            System.out.println("Staff removed successfully.");
        } else {
            System.out.println("Staff not found.");
        }
    }

    // ==================== COURSE ====================

    private void courseMenu() {
        boolean back = false;
        while (!back) {
            System.out.println("\n--- Course Management ---");
            System.out.println("1. Add Course");
            System.out.println("2. View All Courses");
            System.out.println("3. Search Course by ID");
            System.out.println("4. Remove Course");
            System.out.println("5. Back to Main Menu");
            int choice = readInt("Enter choice: ");
            System.out.println();
            switch (choice) {
                case 1 -> addCourse();
                case 2 -> viewAllCourses();
                case 3 -> searchCourse();
                case 4 -> removeCourse();
                case 5 -> back = true;
                default -> System.out.println("Invalid choice.");
            }
        }
    }

    private void addCourse() {
        System.out.println("Add New Course");
        String id = readLine("Course ID: ");
        if (school.findCourseById(id) != null) {
            System.out.println("Course ID already exists.");
            return;
        }
        String name = readLine("Course Name: ");
        String desc = readLine("Description: ");
        int credits = readInt("Credits: ");
        int max = readInt("Max Students: ");

        Course course = new Course(id, name, desc, credits, max);
        if (school.addCourse(course)) {
            System.out.println("Course added successfully!");
        } else {
            System.out.println("Failed to add course.");
        }
    }

    private void viewAllCourses() {
        List<Course> list = school.getAllCourses();
        if (list.isEmpty()) {
            System.out.println("No courses found.");
            return;
        }
        System.out.printf("%-8s %-18s %-8s %-12s %-12s%n",
                "ID", "Name", "Credits", "Teacher", "Enrolled");
        System.out.println("--------------------------------------------------------------");
        for (Course c : list) {
            System.out.printf("%-8s %-18s %-8d %-12s %-12s%n",
                    c.getCourseId(), c.getCourseName(), c.getCredits(),
                    c.getTeacherId() == null ? "N/A" : c.getTeacherId(),
                    c.getEnrolledCount() + "/" + c.getMaxStudents());
        }
    }

    private void searchCourse() {
        String id = readLine("Enter Course ID: ");
        Course c = school.findCourseById(id);
        if (c == null) {
            System.out.println("Course not found.");
        } else {
            c.displayDetails();
        }
    }

    private void removeCourse() {
        String id = readLine("Enter Course ID to remove: ");
        if (school.removeCourse(id)) {
            System.out.println("Course removed successfully.");
        } else {
            System.out.println("Course not found.");
        }
    }

    // ==================== ENROLLMENT ====================

    private void enrollmentMenu() {
        boolean back = false;
        while (!back) {
            System.out.println("\n--- Enrollment / Assignments ---");
            System.out.println("1. Enroll Student in Course");
            System.out.println("2. Assign Teacher to Course");
            System.out.println("3. Back to Main Menu");
            int choice = readInt("Enter choice: ");
            System.out.println();
            switch (choice) {
                case 1 -> enrollStudent();
                case 2 -> assignTeacher();
                case 3 -> back = true;
                default -> System.out.println("Invalid choice.");
            }
        }
    }

    private void enrollStudent() {
        String studentId = readLine("Student ID: ");
        String courseId = readLine("Course ID: ");
        if (school.enrollStudentInCourse(studentId, courseId)) {
            System.out.println("Student enrolled successfully!");
        } else {
            System.out.println("Enrollment failed (invalid IDs, already enrolled, or full).");
        }
    }

    private void assignTeacher() {
        String teacherId = readLine("Teacher ID: ");
        String courseId = readLine("Course ID: ");
        if (school.assignTeacherToCourse(teacherId, courseId)) {
            System.out.println("Teacher assigned successfully!");
        } else {
            System.out.println("Assignment failed (invalid IDs).");
        }
    }

    // ==================== SEARCH (POLYMORPHISM) ====================

    private void searchPerson() {
        String id = readLine("Enter any Person ID (Student/Teacher/Staff): ");
        Person person = school.findPersonById(id);
        if (person == null) {
            System.out.println("No person found with ID: " + id);
        } else {
            System.out.println("Found as: " + person.getRole() + " (runtime type: "
                    + person.getClass().getSimpleName() + ")");
            // Polymorphic call — correct override runs based on actual object type
            person.displayDetails();
        }
    }

    // ==================== INPUT HELPERS ====================

    private String readLine(String prompt) {
        System.out.print(prompt);
        return scanner.nextLine().trim();
    }

    private int readInt(String prompt) {
        while (true) {
            System.out.print(prompt);
            String line = scanner.nextLine().trim();
            try {
                return Integer.parseInt(line);
            } catch (NumberFormatException e) {
                System.out.println("Please enter a valid whole number.");
            }
        }
    }

    private double readDouble(String prompt) {
        while (true) {
            System.out.print(prompt);
            String line = scanner.nextLine().trim();
            try {
                return Double.parseDouble(line);
            } catch (NumberFormatException e) {
                System.out.println("Please enter a valid number.");
            }
        }
    }
}
