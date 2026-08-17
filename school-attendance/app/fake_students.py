"""Generate fake students: Class 1–8, sections A–D, 30 per section = 960."""
from __future__ import annotations

from typing import Iterator

# 8 classes × 4 sections × 30 students = 960
CLASSES = list(range(1, 9))
SECTIONS = ["A", "B", "C", "D"]
STUDENTS_PER_SECTION = 30
DEFAULT_PHONE = "9140980834"

FIRST_NAMES = [
    "Ali", "Sara", "Bilal", "Fatima", "Hassan", "Ayesha", "Omar", "Zainab",
    "Usman", "Maryam", "Hamza", "Hira", "Ahmed", "Noor", "Ibrahim", "Sana",
    "Yusuf", "Amina", "Raza", "Iqra", "Faisal", "Laiba", "Tariq", "Maham",
    "Kashif", "Saba", "Noman", "Hina", "Waleed", "Rabia", "Imran", "Saima",
    "Asad", "Nida", "Junaid", "Kinza", "Farhan", "Mehwish", "Shahid", "Areeba",
    "Danish", "Zara", "Arslan", "Mariam", "Salman", "Anum", "Rizwan", "Sundus",
    "Kamran", "Eman", "Adnan", "Hafsa", "Naveed", "Iqbal", "Sameer", "Bushra",
]

LAST_NAMES = [
    "Khan", "Ahmed", "Hussain", "Ali", "Raza", "Malik", "Sheikh", "Qureshi",
    "Siddiqui", "Butt", "Chaudhry", "Mirza", "Hashmi", "Javed", "Iqbal", "Naz",
    "Akhtar", "Rehman", "Farooq", "Abbas", "Nawaz", "Yousaf", "Bibi", "Shah",
    "Rashid", "Anwar", "Baig", "Gillani", "Mehmood", "Zafar",
]


def class_label(class_num: int, section: str) -> str:
    """Display / sort form: 1-A, 2-B, … 8-D."""
    return f"{class_num}-{section}"


def generate_fake_students() -> list[dict[str, str]]:
    """
    Build 960 students.
    student_id: C{class}{section}{nn} e.g. C1A01 … C8D30
    """
    students: list[dict[str, str]] = []
    n = 0
    for class_num in CLASSES:
        for section in SECTIONS:
            for i in range(1, STUDENTS_PER_SECTION + 1):
                first = FIRST_NAMES[n % len(FIRST_NAMES)]
                last = LAST_NAMES[(n * 3 + class_num + i) % len(LAST_NAMES)]
                # slight variation so names aren't too repetitive
                if (n // len(FIRST_NAMES)) % 2 == 1:
                    first = FIRST_NAMES[(n + 7) % len(FIRST_NAMES)]
                name = f"{first} {last}"
                student_id = f"C{class_num}{section}{i:02d}"
                students.append(
                    {
                        "student_id": student_id,
                        "name": name,
                        "class_name": class_label(class_num, section),
                        "phone": DEFAULT_PHONE,
                    }
                )
                n += 1
    return students


def iter_fake_students() -> Iterator[dict[str, str]]:
    yield from generate_fake_students()


def expected_count() -> int:
    return len(CLASSES) * len(SECTIONS) * STUDENTS_PER_SECTION
