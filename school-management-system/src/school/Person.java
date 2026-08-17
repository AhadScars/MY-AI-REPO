package school;

/**
 * Abstract base class demonstrating ABSTRACTION and ENCAPSULATION.
 * Common attributes and behavior for all people in the school.
 */
public abstract class Person {
    private String id;
    private String name;
    private int age;
    private String gender;
    private String phone;
    private String email;

    public Person(String id, String name, int age, String gender, String phone, String email) {
        this.id = id;
        this.name = name;
        this.age = age;
        this.gender = gender;
        this.phone = phone;
        this.email = email;
    }

    // Getters and setters (Encapsulation)
    public String getId() {
        return id;
    }

    public void setId(String id) {
        this.id = id;
    }

    public String getName() {
        return name;
    }

    public void setName(String name) {
        this.name = name;
    }

    public int getAge() {
        return age;
    }

    public void setAge(int age) {
        if (age > 0) {
            this.age = age;
        }
    }

    public String getGender() {
        return gender;
    }

    public void setGender(String gender) {
        this.gender = gender;
    }

    public String getPhone() {
        return phone;
    }

    public void setPhone(String phone) {
        this.phone = phone;
    }

    public String getEmail() {
        return email;
    }

    public void setEmail(String email) {
        this.email = email;
    }

    /**
     * Abstract method — each subclass must define its own role display.
     * Demonstrates ABSTRACTION and POLYMORPHISM.
     */
    public abstract String getRole();

    /**
     * Abstract method for detailed display — overridden by subclasses.
     */
    public abstract void displayDetails();

    /**
     * Common display of basic info (can be reused via super in subclasses).
     */
    public void displayBasicInfo() {
        System.out.println("ID     : " + id);
        System.out.println("Name   : " + name);
        System.out.println("Age    : " + age);
        System.out.println("Gender : " + gender);
        System.out.println("Phone  : " + phone);
        System.out.println("Email  : " + email);
        System.out.println("Role   : " + getRole());
    }

    @Override
    public String toString() {
        return getRole() + " [ID=" + id + ", Name=" + name + "]";
    }
}
