package school;

/**
 * Staff class demonstrates INHERITANCE and POLYMORPHISM
 * (another Person type with different role/details).
 */
public class Staff extends Person {
    private String designation;  // e.g. Clerk, Librarian, Accountant
    private String department;
    private double salary;
    private String shift;        // Morning / Evening

    public Staff(String id, String name, int age, String gender, String phone, String email,
                 String designation, String department, double salary, String shift) {
        super(id, name, age, gender, phone, email);
        this.designation = designation;
        this.department = department;
        this.salary = salary;
        this.shift = shift;
    }

    public String getDesignation() {
        return designation;
    }

    public void setDesignation(String designation) {
        this.designation = designation;
    }

    public String getDepartment() {
        return department;
    }

    public void setDepartment(String department) {
        this.department = department;
    }

    public double getSalary() {
        return salary;
    }

    public void setSalary(double salary) {
        if (salary >= 0) {
            this.salary = salary;
        }
    }

    public String getShift() {
        return shift;
    }

    public void setShift(String shift) {
        this.shift = shift;
    }

    @Override
    public String getRole() {
        return "Staff";
    }

    @Override
    public void displayDetails() {
        System.out.println("---------- STAFF DETAILS ----------");
        displayBasicInfo();
        System.out.println("Designation : " + designation);
        System.out.println("Department  : " + department);
        System.out.println("Salary      : " + salary);
        System.out.println("Shift       : " + shift);
        System.out.println("-----------------------------------");
    }
}
