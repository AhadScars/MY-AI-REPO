#!/usr/bin/env bash
set -e
cd "$(dirname "$0")"

mkdir -p out

echo "Compiling..."
javac -d out src/school/*.java

echo "Starting School Management System..."
echo
java -cp out school.SchoolManagementSystem
