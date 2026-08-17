# School Management System (Core Java + OOPS)

A console-based **School Management System** written in pure Core Java.
It demonstrates the main Object-Oriented Programming principles:

| Principle | How it is used |
|-----------|----------------|
| **Abstraction** | `Person` is an abstract class with abstract methods `getRole()` and `displayDetails()` |
| **Encapsulation** | Private fields with getters/setters in all model classes |
| **Inheritance** | `Student`, `Teacher`, and `Staff` extend `Person` |
| **Polymorphism** | `Person` references call the correct subclass `displayDetails()` / `getRole()` at runtime |
| **Composition** | `School` has lists of students, teachers, staff, and courses |

## Project Structure

```
school-management-system/
├── src/school/
│   ├── Person.java                 # Abstract base class
│   ├── Student.java                # Extends Person
│   ├── Teacher.java                # Extends Person
│   ├── Staff.java                  # Extends Person
│   ├── Course.java                 # Course entity
│   ├── School.java                 # Manages all entities (composition)
│   └── SchoolManagementSystem.java # Menu-driven main program
├── run.bat                         # Compile & run (Windows)
├── run.sh                          # Compile & run (Linux/macOS)
└── README.md
```

## Features

- Add / view / search / remove **Students**, **Teachers**, **Staff**
- Manage **Courses** and capacity
- Enroll students in courses
- Assign teachers to courses
- Collect student fees and track pending amounts
- Give salary raise to teachers
- School summary report
- Sample data loaded on startup

## Requirements

- JDK 11 or higher (`java` and `javac` on PATH)

## How to Run

### Windows

```bat
run.bat
```

Or manually:

```bat
cd school-management-system
javac -d out src\school\*.java
java -cp out school.SchoolManagementSystem
```

### Linux / macOS / WSL

```bash
chmod +x run.sh
./run.sh
```

Or manually:

```bash
cd school-management-system
javac -d out src/school/*.java
java -cp out school.SchoolManagementSystem
```

## Sample IDs (preloaded)

| Type | IDs |
|------|-----|
| Students | S001, S002, S003, S004 |
| Teachers | T001, T002, T003 |
| Staff | ST001, ST002 |
| Courses | C101, C102, C103, C104 |

## Main Menu

1. Student Management  
2. Teacher Management  
3. Staff Management  
4. Course Management  
5. Enrollment / Assignments  
6. Search Person by ID (Polymorphism demo)  
7. Display All People  
8. School Summary Report  
9. Exit  
