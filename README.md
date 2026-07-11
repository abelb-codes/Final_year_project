# AI-Integrated Academic Advisory and Case Management System

An intelligent web-based platform designed to improve academic advising services by enabling efficient communication between students, academic advisors, and university administrators. The system integrates Artificial Intelligence to provide academic guidance, automate case handling, and support faster resolution of student requests.

---

## Overview

In many universities, students face difficulties accessing academic advisors due to limited advisor availability, large student populations, and manual communication processes. Academic cases such as course selection issues, academic difficulties, and administrative requests often require significant time to process and track.

The **AI-Integrated Academic Advisory and Case Management System** provides a centralized platform where students can submit academic cases, communicate with advisors, receive AI-assisted academic guidance, and monitor case progress.

The system helps advisors organize and manage student requests while allowing administrators to monitor academic advisory activities through reports and analytics.

---

# Problem Statement

Traditional academic advisory systems face several challenges:

* Students have difficulty reaching advisors when needed.
* Academic cases are handled manually and may take longer to resolve.
* Students cannot easily track the status of submitted requests.
* Advisors spend significant time answering repetitive questions.
* Lack of centralized records makes case management difficult.

These challenges reduce the effectiveness and accessibility of academic support services.

---

# Objectives

## General Objective

To develop an AI-integrated academic advisory and case management system that improves communication, accessibility, and efficiency of academic support services.

## Specific Objectives

* Develop a platform for students to submit and manage academic cases.
* Provide communication between students and academic advisors.
* Integrate AI-based assistance for common academic inquiries.
* Automate case categorization and prioritization.
* Allow advisors to efficiently manage student requests.
* Provide case tracking and notification mechanisms.
* Generate reports for university administrators.

---

# System Features

## Student Module

Students can:

* Create an account and log in securely.
* Submit academic cases.
* Select case categories.
* Add descriptions and attachments.
* Track case progress.
* Receive advisor responses.
* Communicate with advisors.
* Use AI academic assistance.
* View academic announcements.

---

## Academic Advisor Module

Advisors can:

* Access assigned student cases.
* Review student requests.
* Respond to academic cases.
* Update case status.
* Add recommendations.
* View previous case history.
* Manage student consultations.

---

## Administrator Module

Administrators can:

* Manage students and advisors.
* Manage departments and academic programs.
* Assign cases to advisors.
* Monitor system activities.
* Generate reports.
* Analyze case statistics.
* Manage system settings.

---

# AI Integration

The system uses Artificial Intelligence to improve academic support through:

## AI Academic Assistant

* Answers common academic questions.
* Provides guidance based on university information.
* Reduces repetitive advisor workload.

## Intelligent Case Management

* Automatically categorizes submitted cases.
* Predicts case priority.
* Suggests suitable responses.
* Helps advisors handle cases faster.

## Recommendation System

* Provides academic recommendations.
* Suggests possible solutions based on case information.
* Supports advisor decision-making.

---

# Technology Stack

## Frontend

* React
* JavaScript / TypeScript
* Tailwind CSS
* Axios

## Backend

* Python
* Django
* Django REST Framework

## Database

* PostgreSQL

## Artificial Intelligence

* Python
* Natural Language Processing (NLP)
* Machine Learning
* Sentence Transformers
* Scikit-learn
* spaCy

## Development Tools

* Git
* GitHub
* Docker
* Postman

---

# System Architecture

```
                    Users

        Student | Advisor | Administrator

                      |
                      v

              Frontend Application

                      |
                      v

              Django REST API

                      |
        --------------------------------
        |              |               |
        v              v               v

 Case Management   AI Engine     Authentication

        |              |
        ----------------
                      |
                      v

              PostgreSQL Database
```

---

# Functional Requirements

## Student

* Register and authenticate.
* Submit academic cases.
* View case history.
* Track case status.
* Receive responses.
* Interact with AI assistant.

## Advisor

* View assigned cases.
* Review student information.
* Respond to cases.
* Update case status.
* Provide academic recommendations.

## Administrator

* Manage system users.
* Assign advisors.
* Monitor cases.
* Generate reports.
* Maintain system information.

---

# Non-Functional Requirements

* Security and privacy protection.
* Fast response time.
* User-friendly interface.
* System scalability.
* Reliability and availability.
* Maintainable software structure.
* Data consistency.

---

# Installation

## Clone Repository

```bash
git clone https://github.com/yourusername/academic-advisory-system.git

cd academic-advisory-system
```

## Backend Setup

Create virtual environment:

```bash
python -m venv venv
```

Activate environment:

Windows:

```bash
venv\Scripts\activate
```

Linux/macOS:

```bash
source venv/bin/activate
```

Install dependencies:

```bash
pip install -r requirements.txt
```

Run migrations:

```bash
python manage.py migrate
```

Start server:

```bash
python manage.py runserver
```

---

# Project Structure

```
AI-Academic-Advisory-System/

├── backend/
│   ├── accounts/
│   ├── users/
│   ├── cases/
│   ├── advisory/
│   ├── ai/
│   ├── notifications/
│   └── config/
│
├── frontend/
│   ├── src/
│   ├── components/
│   └── pages/
│
├── database/
├── documentation/
├── requirements.txt
└── README.md
```

---

# Future Enhancements

* Mobile application.
* Voice-based academic assistant.
* Multilingual AI support.
* Integration with university management systems.
* Predictive analytics for identifying students needing support.
* Appointment scheduling system.
* Email and SMS notifications.

---

# Author

**Abel B**

Final Year Project

---

# License

Developed for academic purposes.
