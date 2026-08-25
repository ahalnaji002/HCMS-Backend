# HCMS Backend

Backend API for the **Healthcare Conflict Management System (HCMS)**.

## Technologies

* Node.js
* Express.js
* MySQL
* Knex.js

## Requirements

Make sure the following are installed:

* Node.js
* npm
* MySQL
* Git

## Installation

Clone the repository:

```bash
git clone https://github.com/ahalnaji002/HCMS-Backend.git
```

Enter the project directory:

```bash
cd HCMS-Backend
```

Switch to the development branch:

```bash
git checkout develop
```

Install dependencies:

```bash
npm install
```

## Environment Variables

Create a `.env` file in the project root.

Use `.env.example` as a reference:

```env
PORT=3000

DB_HOST=localhost
DB_PORT=3306
DB_USER=root
DB_PASSWORD=your_mysql_password
DB_NAME=hcms_db
```

> Do not commit the `.env` file to GitHub.

## Database Setup

Create the development database:

```sql
CREATE DATABASE hcms_db;
```

Run database migrations:

```bash
npm run migrate
```

Run database seeds:

```bash
npm run seed
```

Rollback the latest migration:

```bash
npm run migrate:rollback
```

## Run the Backend

Development mode:

```bash
npm run dev
```

Production mode:

```bash
npm start
```

The API runs by default at:

```text
http://localhost:3000
```

## Branching

* `main` — stable version
* `develop` — development integration branch
* `feature/...` — individual feature branches

New development work should not be committed directly to `main`.

Typical workflow:

```text
develop → feature/... → develop → main
```

## Project Structure

```text
HCMS-Backend/
│
├── database/
│   ├── migrations/
│   └── seeds/
│
├── src/
│   ├── config/
│   ├── controllers/
│   ├── middleware/
│   ├── models/
│   ├── routes/
│   ├── services/
│   ├── utils/
│   ├── app.js
│   └── server.js
│
├── .env.example
├── .gitignore
├── knexfile.js
├── package.json
└── README.md
```
