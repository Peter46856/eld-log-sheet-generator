# React + Vite

GitHub: https://github.com/Peter46856/eld-log-sheet-generator

Loom Link for the app:https://www.loom.com/share/6f6f86d3bab9490282f0dcc59f6d12f6?t=367&sid=735ac9e2-9d07-4084-aab9-dbbc3ae604f9

Loom Link for the code:https://www.loom.com/share/e60776d3712c44d8a95c7318a9526a9a?sid=9f627a7a-d05d-4c2d-82dd-7e0f39621d64

Vercel Link1: "https://eld-log-sheet-generator-git-main-peter-juma-mutisos-projects.vercel.app/"
Vercel Link2:"https://eld-log-sheet-generator-nhv8x3zpy-peter-juma-mutisos-projects.vercel.app/"

This template provides a minimal setup to get React working in Vite with HMR and some ESLint rules.

Currently, two official plugins are available:

- [@vitejs/plugin-react](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react) uses [Babel](https://babeljs.io/) for Fast Refresh
- [@vitejs/plugin-react-swc](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react-swc) uses [SWC](https://swc.rs/) for Fast Refresh

## Expanding the ESLint configuration

If you are developing a production application, we recommend using TypeScript with type-aware lint rules enabled. Check out the [TS template](https://github.com/vitejs/vite/tree/main/packages/create-vite/template-react-ts) for information on how to integrate TypeScript and [`typescript-eslint`](https://typescript-eslint.io) in your project.


# ELD Log Sheet Generator

This project provides a web application for Electronic Logging Device (ELD) log management, featuring a React frontend to display daily logs fetched from a Django backend and generate PDF log sheets.

## Table of Contents

* [Features](#features)
* [Technologies Used](#technologies-used)
* [Project Structure](#project-structure)
* [Setup Instructions](#setup-instructions)
    * [Prerequisites](#prerequisites)
    * [Backend Setup (Django)](#backend-setup-django)
    * [Frontend Setup (React)](#frontend-setup-react)
* [Usage](#usage)
* [Troubleshooting](#troubleshooting)


## Features

* **Daily Log Display:** Fetches and displays ELD log data for different dates.
* **Log Summary Calculation:** Calculates and presents summaries for driving, on-duty (not driving), sleeper berth, and off-duty hours.
* **PDF Generation:** Allows users to generate printable PDF versions of daily log sheets with detailed log entries and summaries.
* **Robust Error Handling:** Includes client-side error handling for API requests, providing clear feedback on network or server issues.

## Technologies Used

### Frontend
* **React.js:** A JavaScript library for building user interfaces.
* **jsPDF:** A client-side JavaScript library for generating PDFs.
* **CSS:** For styling the application.
* **Axios

### Backend
* **Django:** A high-level Python web framework (implied for serving `/api/eld-logs`).
* **cors
* **OpenRouteService API:** Maps API

## Project Structure



## Setup Instructions

Follow these steps to get the project up and running on your local machine.

### Prerequisites

Make sure you have the following installed:
* Python 3.x
* Node.js (LTS version recommended)
* npm (comes with Node.js) or yarn

### Backend Setup (Django)

1.  **Navigate to the backend directory:**
    ```bash
    cd full-stack-eld-app/eld_backend
    ```
2.  **Create a Python virtual environment:**
    ```bash
    python -m venv venv
    ```
3.  **Activate the virtual environment:**
    * On macOS/Linux:
        ```bash
        source venv/bin/activate
        ```
    * On Windows:
        ```bash
        .\venv\Scripts\activate
        ```
4.  **Install Django and other dependencies:**
    (You'll need a `requirements.txt` file in your `backend` directory listing all Python dependencies.)
    ```bash
    pip install -r requirements.txt
    ```
    If you don't have a `requirements.txt`, you'll need to install Django:
    ```bash
    pip install django djangorestframework # Add other dependencies as needed
    ```
5.  **Run database migrations:**
    ```bash
    python manage.py migrate
    ```
6.  **Start the Django development server:**
    ```bash
    python manage.py runserver
    ```
    The backend server should now be running, typically at `http://127.0.0.1:8000/`.

### Frontend Setup (React)

1.  **Open a new terminal and navigate to the frontend directory:**
    ```bash
    cd full-stack-eld-app/eld-frontend
    ```
2.  **Install frontend dependencies:**
    ```bash
    npm install
    # or
    yarn install
    ```
    
3.  **Start the React development server:**
    ```bash
    npm start
    # or
    yarn start
    ```
    The React application will usually open in your browser at `http://localhost:3000/`.

    **Note:** Ensure your React app can communicate with your Django backend. If they are on different ports or domains, you might need to configure a proxy in `package.json` or handle CORS on the Django side. For development, adding `"proxy": "http://127.0.0.1:8000"` to your `frontend/package.json` is a common approach if your Django backend is running on port 8000.

## Usage

Once both the Django backend and React frontend servers are running:

1.  Open your web browser and go to `http://localhost:5173/`.
2.  The application will attempt to fetch ELD logs using the `tripId` prop passed to `LogSheetDisplay`.
3.  You will see a list of available dates. Click the "Generate PDF" button next to a date to create a PDF log sheet for that day.
4.  Check the browser console for any network requests or errors if logs don't load correctly.

## Troubleshooting

* **"Failed to fetch logs: SyntaxError: JSON.parse: unexpected character at line 1 column 1"**: This error typically means the frontend expected JSON but received something else (like HTML for a 404/500 error page, or malformed JSON).
    * **Check the Network Tab:** In your browser's developer tools (F12), go to the "Network" tab. Find the request to `/api/eld-logs`. Check its HTTP status code (e.g., 200, 404, 500) and examine the "Response" tab to see the raw data the server sent back.
    * **Verify Backend Endpoint:** Ensure the `/api/eld-logs` endpoint is correctly implemented and accessible in your Django backend and that it returns valid JSON.
    * **Server Logs:** Check your Django backend server console for any error messages.
    * **CORS:** If your frontend and backend are on different origins, ensure Cross-Origin Resource Sharing (CORS) is properly configured on your Django backend.



