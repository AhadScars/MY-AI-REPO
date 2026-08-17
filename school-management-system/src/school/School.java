package school;

import java.util.ArrayList;
import java.util.List;

/**
 * School class demonstrates COMPOSITION / AGGREGATION:
 * A School "has-a" collection of Students, Teachers, Staff, and Courses.
 * Acts as the central service layer for management operations.
 */
public class School {
    private String schoolName;
    private String address;
    private final List<Student> students;
    private final List<Teacher> teachers;
    private final List<Staff> staffList;
    private final List<Course> courses;

    public School(String schoolName, String address) {
        this.schoolName = schoolName;
        this.address = address;
        this.students = new ArrayList<>();
        this.teachers = new ArrayList<>();
        this.staffList = new ArrayList<>();
        this.courses = new ArrayList<>();
    }

    public String getSchoolName() {
        return schoolName;
    }

    public void setSchoolName(String schoolName) {
        this.schoolName = schoolName;
    }

    public String getAddress() {
        return address;
    }

    public void setAddress(String address) {
        this.address = address;
    }

    // ========== STUDENT OPERATIONS ==========

    public boolean addStudent(Student student) {
        if (student == null || findStudentById(student.getId()) != null) {
            return false;
        }
        students.add(student);
        return true;
    }

    public Student findStudentById(String id) {
        for (Student s : students) {
            if (s.getId().equalsIgnoreCase(id)) {
                return s;
            }
        }
        return null;
    }

    public boolean removeStudent(String id) {
        Student s = findStudentById(id);
        if (s == null) {
            return false;
        }
        // Unenroll from courses
        for (String courseId : s.getEnrolledCourseIds()) {
            Course c = findCourseById(courseId);
            if (c != null) {
                c.unenrollStudent();
            }
        }
        return students.remove(s);
    }

    public List<Student> getAllStudents() {
        return new ArrayList<>(students);
    }

    public List<Student> getStudentsByGrade(String grade) {
        List<Student> result = new ArrayList<>();
        for (Student s : students) {
            if (s.getGrade().equalsIgnoreCase(grade)) {
                result.add(s);
            }
        }
        return result;
    }

    // ========== TEACHER OPERATIONS ==========

    public boolean addTeacher(Teacher teacher) {
        if (teacher == null || findTeacherById(teacher.getId()) != null) {
            return false;
        }
        teachers.add(teacher);
        return true;
    }

    public Teacher findTeacherById(String id) {
        for (Teacher t : teachers) {
            if (t.getId().equalsIgnoreCase(id)) {
                return t;
            }
        }
        return null;
    }

    public boolean removeTeacher(String id) {
        Teacher t = findTeacherById(id);
        if (t == null) {
            return false;
        }
        // Unassign from courses
        for (Course c : courses) {
            if (id.equalsIgnoreCase(c.getTeacherId())) {
                c.setTeacherId(null);
            }
        }
        return teachers.remove(t);
    }

    public List<Teacher> getAllTeachers() {
        return new ArrayList<>(teachers);
    }

    // ========== STAFF OPERATIONS ==========

    public boolean addStaff(Staff staff) {
        if (staff == null || findStaffById(staff.getId()) != null) {
            return false;
        }
        staffList.add(staff);
        return true;
    }

    public Staff findStaffById(String id) {
        for (Staff s : staffList) {
            if (s.getId().equalsIgnoreCase(id)) {
                return s;
            }
        }
        return null;
    }

    public boolean removeStaff(String id) {
        Staff s = findStaffById(id);
        if (s == null) {
            return false;
        }
        return staffList.remove(s);
    }

    public List<Staff> getAllStaff() {
        return new ArrayList<>(staffList);
    }

    // ========== COURSE OPERATIONS ==========

    public boolean addCourse(Course course) {
        if (course == null || findCourseById(course.getCourseId()) != null) {
            return false;
        }
        courses.add(course);
        return true;
    }

    public Course findCourseById(String id) {
        for (Course c : courses) {
            if (c.getCourseId().equalsIgnoreCase(id)) {
                return c;
            }
        }
        return null;
    }

    public boolean removeCourse(String id) {
        Course c = findCourseById(id);
        if (c == null) {
            return false;
        }
        // Remove from student enrollments
        for (Student s : students) {
            s.unenrollCourse(id);
        }
        // Remove from teacher assignments
        for (Teacher t : teachers) {
            t.removeCourse(id);
        }
        return courses.remove(c);
    }

    public List<Course> getAllCourses() {
        return new ArrayList<>(courses);
    }

    // ========== RELATIONSHIP OPERATIONS ==========

    /**
     * Enroll a student in a course (bidirectional link).
     */
    public boolean enrollStudentInCourse(String studentId, String courseId) {
        Student student = findStudentById(studentId);
        Course course = findCourseById(courseId);
        if (student == null || course == null) {
            return false;
        }
        if (!course.hasSeats()) {
            return false;
        }
        if (student.getEnrolledCourseIds().contains(courseId)) {
            return false; // already enrolled
        }
        if (course.enrollStudent()) {
            student.enrollCourse(courseId);
            return true;
        }
        return false;
    }

    /**
     * Assign a teacher to a course.
     */
    public boolean assignTeacherToCourse(String teacherId, String courseId) {
        Teacher teacher = findTeacherById(teacherId);
        Course course = findCourseById(courseId);
        if (teacher == null || course == null) {
            return false;
        }
        // Unassign previous teacher if any
        if (course.getTeacherId() != null) {
            Teacher prev = findTeacherById(course.getTeacherId());
            if (prev != null) {
                prev.removeCourse(courseId);
            }
        }
        course.setTeacherId(teacherId);
        teacher.assignCourse(courseId);
        return true;
    }

    // ========== POLYMORPHISM DEMO ==========

    /**
     * Demonstrates POLYMORPHISM: Person reference can hold Student, Teacher, or Staff.
     */
    public Person findPersonById(String id) {
        Student s = findStudentById(id);
        if (s != null) {
            return s;
        }
        Teacher t = findTeacherById(id);
        if (t != null) {
            return t;
        }
        return findStaffById(id);
    }

    /**
     * Displays all people using polymorphic displayDetails().
     */
    public void displayAllPeople() {
        System.out.println("\n===== ALL PEOPLE IN SCHOOL (Polymorphism) =====");
        List<Person> everyone = new ArrayList<>();
        everyone.addAll(students);
        everyone.addAll(teachers);
        everyone.addAll(staffList);

        if (everyone.isEmpty()) {
            System.out.println("No people registered yet.");
            return;
        }
        for (Person p : everyone) {
            // Runtime polymorphism: correct subclass method is called
            p.displayDetails();
            System.out.println();
        }
    }

    // ========== REPORTS ==========

    public void showSummary() {
        System.out.println("\n========== SCHOOL SUMMARY ==========");
        System.out.println("School  : " + schoolName);
        System.out.println("Address : " + address);
        System.out.println("Students: " + students.size());
        System.out.println("Teachers: " + teachers.size());
        System.out.println("Staff   : " + staffList.size());
        System.out.println("Courses : " + courses.size());

        double totalPending = 0;
        for (Student s : students) {
            totalPending += s.getPendingFees();
        }
        System.out.println("Total Pending Fees: " + totalPending);
        System.out.println("====================================");
    }

    public void loadSampleData() {
        // Teachers
        Teacher t1 = new Teacher("T001", "Anita Sharma", 35, "Female", "9876500001",
                "anita@school.com", "Science", "Physics", 45000, 10);
        Teacher t2 = new Teacher("T002", "Rajesh Kumar", 42, "Male", "9876500002",
                "rajesh@school.com", "Mathematics", "Algebra", 50000, 15);
        Teacher t3 = new Teacher("T003", "Priya Mehta", 30, "Female", "9876500003",
                "priya@school.com", "English", "Literature", 40000, 6);
        addTeacher(t1);
        addTeacher(t2);
        addTeacher(t3);

        // Staff
        Staff st1 = new Staff("ST001", "Ramesh Yadav", 40, "Male", "9876500010",
                "ramesh@school.com", "Librarian", "Library", 25000, "Morning");
        Staff st2 = new Staff("ST002", "Sunita Devi", 38, "Female", "9876500011",
                "sunita@school.com", "Accountant", "Accounts", 30000, "Morning");
        addStaff(st1);
        addStaff(st2);

        // Courses
        Course c1 = new Course("C101", "Physics", "Fundamentals of Physics", 4, 40);
        Course c2 = new Course("C102", "Mathematics", "Algebra and Geometry", 5, 45);
        Course c3 = new Course("C103", "English", "English Literature", 3, 50);
        Course c4 = new Course("C104", "Chemistry", "Basic Chemistry", 4, 40);
        addCourse(c1);
        addCourse(c2);
        addCourse(c3);
        addCourse(c4);

        assignTeacherToCourse("T001", "C101");
        assignTeacherToCourse("T002", "C102");
        assignTeacherToCourse("T003", "C103");

        // Students
        Student s1 = new Student("S001", "Aarav Patel", 15, "Male", "9876500101",
                "aarav@mail.com", "10", "A", "Mr. Patel", 25000);
        Student s2 = new Student("S002", "Isha Gupta", 14, "Female", "9876500102",
                "isha@mail.com", "9", "B", "Mrs. Gupta", 22000);
        Student s3 = new Student("S003", "Kabir Singh", 16, "Male", "9876500103",
                "kabir@mail.com", "11", "A", "Mr. Singh", 28000);
        Student s4 = new Student("S004", "Meera Joshi", 15, "Female", "9876500104",
                "meera@mail.com", "10", "A", "Mrs. Joshi", 25000);
        addStudent(s1);
        addStudent(s2);
        addStudent(s3);
        addStudent(s4);

        s1.payFees(15000);
        s2.payFees(22000);
        s3.payFees(10000);

        enrollStudentInCourse("S001", "C101");
        enrollStudentInCourse("S001", "C102");
        enrollStudentInCourse("S002", "C103");
        enrollStudentInCourse("S003", "C101");
        enrollStudentInCourse("S003", "C102");
        enrollStudentInCourse("S004", "C101");
        enrollStudentInCourse("S004", "C103");
    }
}
