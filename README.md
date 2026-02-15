# Online English Tutoring (Front-End Only SPA)

A complete browser-only web app for online English tutoring, built with **HTML + CSS + vanilla JavaScript**.  
No backend, no framework, and no build step required.

## Features

- SPA-style navigation (hash routing, no page reload)
- Sign In / Sign Up (Student or Tutor)
- LocalStorage-based persistence:
  - users
  - session
  - lessons
  - chat
  - lesson notes
  - whiteboard data
  - exercises/progress
  - dark mode preference
- Role-based dashboards (Student vs Tutor)
- Scheduling:
  - student lesson requests
  - tutor accept/decline
  - weekly and upcoming views
- Live Lesson Room:
  - per-lesson text chat
  - shared notes
  - whiteboard (draw/undo/clear/snapshot)
  - vocabulary + corrections tools
  - countdown timer
- Exercises:
  - vocabulary flashcards
  - grammar quiz
  - writing prompt with tutor feedback/rubric
- Progress:
  - student KPIs + quiz trend bars
  - tutor student-overview table
- Guest Free Trial Language Game:
  - sequential grammar quiz
  - 60 seconds per question
  - 5 questions
  - special popup on perfect score (5/5)
- Accessibility basics:
  - focus states
  - skip link
  - semantic layout/labels
- Responsive UI + Dark mode

## Tech Stack

- `index.html`
- `styles.css`
- `script.js`
- Browser APIs:
  - `localStorage`
  - `Web Crypto` (SHA-256 password hashing when available)
  - `Canvas` (whiteboard)

## Project Structure

```text
new-project/
  index.html
  styles.css
  script.js
