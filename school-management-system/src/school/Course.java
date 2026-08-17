package school;

/**
 * Course entity — demonstrates ENCAPSULATION of course data.
 * Used with COMPOSITION inside the School class.
 */
public class Course {
    private String courseId;
    private String courseName;
    private String description;
    private int credits;
    private String teacherId;   // assigned teacher (nullable until assigned)
    private int maxStudents;
    private int enrolledCount;

    public Course(String courseId, String courseName, String description,
                  int credits, int maxStudents) {
        this.courseId = courseId;
        this.courseName = courseName;
        this.description = description;
        this.credits = credits;
        this.maxStudents = maxStudents;
        this.enrolledCount = 0;
        this.teacherId = null;
    }

    public String getCourseId() {
        return courseId;
    }

    public String getCourseName() {
        return courseName;
    }

    public void setCourseName(String courseName) {
        this.courseName = courseName;
    }

    public String getDescription() {
        return description;
    }

    public void setDescription(String description) {
        this.description = description;
    }

    public int getCredits() {
        return credits;
    }

    public void setCredits(int credits) {
        if (credits > 0) {
            this.credits = credits;
        }
    }

    public String getTeacherId() {
        return teacherId;
    }

    public void setTeacherId(String teacherId) {
        this.teacherId = teacherId;
    }

    public int getMaxStudents() {
        return maxStudents;
    }

    public void setMaxStudents(int maxStudents) {
        if (maxStudents > 0) {
            this.maxStudents = maxStudents;
        }
    }

    public int getEnrolledCount() {
        return enrolledCount;
    }

    public boolean hasSeats() {
        return enrolledCount < maxStudents;
    }

    public boolean enrollStudent() {
        if (hasSeats()) {
            enrolledCount++;
            return true;
        }
        return false;
    }

    public boolean unenrollStudent() {
        if (enrolledCount > 0) {
            enrolledCount--;
            return true;
        }
        return false;
    }

    public void displayDetails() {
        System.out.println("---------- COURSE DETAILS ----------");
        System.out.println("Course ID   : " + courseId);
        System.out.println("Name        : " + courseName);
        System.out.println("Description : " + description);
        System.out.println("Credits     : " + credits);
        System.out.println("Teacher ID  : " + (teacherId == null ? "Not assigned" : teacherId));
        System.out.println("Capacity    : " + enrolledCount + " / " + maxStudents);
        System.out.println("------------------------------------");
    }

    @Override
    public String toString() {
        return courseId + " - " + courseName + " (" + enrolledCount + "/" + maxStudents + ")";
    }
}
