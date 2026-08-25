# HCMS Backend

Backend API for the Healthcare Conflict Management System (HCMS).

## Technologies

- Node.js
- Express.js
- MySQL
- Knex.js
- Axios-compatible REST API

## Requirements

Make sure the following are installed:

- Node.js
- npm
- MySQL
- Git

## Installation

Clone the repository:

git clone https://github.com/ahalnaji002/HCMS-Backend.git

Enter the project directory:

cd HCMS-Backend

Switch to the development branch:

git checkout develop

Install dependencies:

npm install

## Environment Variables

Create a `.env` file in the project root.

Use `.env.example` as a reference:

PORT=3000

DB_HOST=localhost
DB_PORT=3306
DB_USER=root
DB_PASSWORD=your_mysql_password
DB_NAME=hcms_db

Do not commit the `.env` file to GitHub.

## Database

Create the development database:

CREATE DATABASE hcms_db;

Run database migrations:

npm run migrate

Run seeds:

npm run seed

Rollback the latest migration:

npm run migrate:rollback

## Run the Backend

Development mode:

npm run dev

Production mode:

npm start

The API will run by default on:

http://localhost:3000

## Branching

- `main` — stable version
- `develop` — development integration branch
- `feature/...` — individual feature branches

New development work should not be committed directly to `main`.

## Project Structure

src/
├── config/
├── controllers/
├── middleware/
├── models/
├── routes/
├── services/
├── utils/
├── app.js
└── server.js

database/
├── migrations/
└── seeds/
