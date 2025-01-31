require('dotenv').config(); 
const express = require('express');
const mysql = require('mysql2');
const bodyParser = require('body-parser');
const nodemailer = require("nodemailer");
const cors = require('cors');

const app = express();
const PORT = 3000;


let otpStore = {}; // Store OTPs temporarily
const EMAIL_USER = "c92084860@gmail.com";
const EMAIL_PASS = "skby bqhs bizg jgbv";


// Middleware
app.use(bodyParser.json());
app.use(cors());

// MySQL Connection
const db = mysql.createConnection({
  host: process.env.DB_HOST,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
  port: process.env.DB_PORT
});

db.connect((err) => {
  if (err) {
    console.error('Error connecting to MySQL:', err);
  } else {
    console.log('Connected to MySQL');
  }
});

// Helper Function to Check Attendance
const attendanceCount = (rollNumber) => {
  return new Promise((resolve, reject) => {
    db.query(
      'SELECT COUNT(*) AS count FROM attendance WHERE rollNo = ? AND DATE(date) = CURDATE()',
      [rollNumber],
      (err, result) => {
        if (err) {
          return reject('Error checking attendance');
        }
        resolve(result[0].count > 2 ? 'Visited' : 'Pass');
      }
    );
  });
};

const decideUser = (email) => {
  return new Promise((resolve, reject) => {
    db.query(
      'SELECT preference FROM users WHERE email = ?',
      [email],
      (err, result) => {
        if (err) {
          return reject('Error checking user preference');
        }
        
        // Check preference and resolve accordingly
        const preference = result[0]?.preference;
        if (preference === 'mess') {
          resolve('worker');
        } else if (preference === 'admin') {
          resolve('admin');
        } else {
          resolve('student');
        }
      }
    );
  });
};
// Routes

// Get all students
app.get('/students', (req, res) => {
  db.query('SELECT * FROM users', (err, results) => {
    if (err) {
      res.status(500).json({ error: 'Error fetching students' });
    } else {
      res.json(results);
    }
  });
});

// Fetch student data by roll number and preference
app.post('/students/get', async (req, res) => {
  const { rollNumber, preference } = req.body;
  console.log(rollNumber);
  try {
    db.query(
      'SELECT * FROM users WHERE rollNo = ? AND preference = ?',
      [rollNumber, preference],
      async (err, results) => {
        if (err) {
          console.log(err);
          return res.status(500).json({ error: 'Error fetching student data' });
        } else if (results.length === 0) {
          console.log(err);
          return res.status(404).json({ message: 'Student not found' });
        }
        const student = results[0];
        console.log(results);
        const entryStatus = await attendanceCount(student.rollNo);
        res.json({ student, entry: entryStatus });
      }
    );
  } catch (error) {
    res.status(500).json({ error: 'Error processing request' });
  }
});

app.post('/students/gets', async (req, res) => {
  const { rollNumber } = req.body;
  console.log(rollNumber);
  try {
    db.query(
      'SELECT * FROM users WHERE rollNo = ?',
      [rollNumber],
      async (err, results) => {
        if (err) {
          console.log(err);
          return res.status(500).json({ error: 'Error fetching student data' });
        } else if (results.length === 0) {
          console.log(err);
          return res.status(404).json({ message: 'Student not found' });
        }
        const student = results[0];
        console.log(results);
        const entryStatus = await attendanceCount(student.rollNo);
        res.json({ student, entry: entryStatus });
      }
    );
  } catch (error) {
    res.status(500).json({ error: 'Error processing request' });
  }
});


// Add a new user
app.post('/add-user', (req, res) => {
  const { name, email, rollNo, preference, photo } = req.body;

  if (!name || !email || !rollNo || !preference || !photo) {
    return res.status(400).json({ error: 'Name, email, rollNo, preference, and photo are required' });
  }

  const query = 'INSERT INTO users (name, email, rollNo, preference, photo) VALUES (?, ?, ?, ?, ?)';
  db.query(query, [name, email, rollNo, preference, photo], (err, result) => {
    if (err) {
      return res.status(500).json({ error: 'Error adding user' });
    }
    res.status(201).json({ success: 'User added successfully', userId: result.insertId });
  });
});
// Update an existing user (only email and preference can be updated)
app.put('/update-user', (req, res) => {
  const { rollNumber, email, preference } = req.body;

  if (!rollNumber || !email || !preference) {
    return res.status(400).json({ error: 'Roll number, email, and preference are required' });
  }

  const query = 'UPDATE users SET email = ?, preference = ? WHERE rollNo = ?';
  db.query(query, [email, preference, rollNumber], (err, result) => {
    if (err) {
      return res.status(500).json({ error: 'Error updating user' });
    }
    if (result.affectedRows === 0) {
      return res.status(404).json({ error: 'User not found' });
    }
    res.status(200).json({ success: 'User updated successfully' });
  });
});
// Delete a user by roll number (from body)
app.delete('/delete-user', (req, res) => {
  const { rollNumber } = req.body;

  if (!rollNumber) {
    return res.status(400).json({ error: 'Roll number is required' });
  }

  const query = 'DELETE FROM users WHERE roll_number = ?';
  db.query(query, [rollNumber], (err, result) => {
    if (err) {
      return res.status(500).json({ error: 'Error deleting user' });
    }
    if (result.affectedRows === 0) {
      return res.status(404).json({ error: 'User not found' });
    }
    res.status(200).json({ success: 'User deleted successfully' });
  });
});

app.post('/students/getemail', async (req, res) => {
  const { email } = req.body;
  console.log(email);
  try {
    db.query(
      'SELECT * FROM users WHERE email = ?',
      [email],
      async (err, results) => {
        if (err) {
          console.log(err);
          return res.status(500).json({ error: 'Error fetching student data' });
        } else if (results.length === 0) {
          console.log(err);
          return res.status(404).json({ message: 'Student not found' });
        }
        const student = results[0];
        console.log(results);
        const entryStatus = await attendanceCount(student.rollNo);
        res.json({ student, entry: entryStatus });
      }
    );
  } catch (error) {
    res.status(500).json({ error: 'Error processing request' });
  }
});

// Send OTP via email
app.post("/send-otp", async (req, res) => {
  const { email } = req.body;
  if (!email) {
      return res.status(400).json({ error: "Email is required" });
  }
  
  console.log(`Sending OTP to: ${email}`);
  
  const otp = Math.floor(100000 + Math.random() * 900000).toString(); // Generate 6-digit OTP
  otpStore[email] = otp;

  let transporter = nodemailer.createTransport({
      service: "gmail",
      auth: {
          user: EMAIL_USER,
          pass: EMAIL_PASS,
      },
  });

  let mailOptions = {
      from: EMAIL_USER,
      to: email,
      subject: `IIIT Manipur Mess Login Credential OTP is ${otp}`,
      text: `Dear IIITian,\nYour One-Time Password (OTP) for verification is:\n\n🔢 ${otp}\n\nPlease enter this OTP within the next 10 minutes to complete your verification.\nIf you did not request this OTP, please ignore this email.\n\nThank you,\nFrom Mess of IIITM` // Fixed string formatting
  };

  try {
      await transporter.sendMail(mailOptions);
      res.json({ success: true, message: "OTP sent successfully" });
  } catch (error) {
      console.error("❌ Error sending OTP:", error);
      res.status(500).json({ error: "Failed to send OTP" });
  }
});

// Verify OTP
app.post("/verify-otp", (req, res) => {
  const { email, otp } = req.body;

  // Check if email and otp are provided
  if (!email || !otp) {
    return res.status(400).json({ error: "Email and OTP are required" });
  }

  // Check if OTP is valid for the email
  if (otpStore[email] && otpStore[email] === otp) {
    delete otpStore[email]; // OTP should be used only once

    // Now, call decideUser function to get the user type based on preference
    decideUser(email)
      .then(userType => {
        // Send success response with the user type
        return res.json({
          success: true,
          message: "OTP verified successfully",
          userType: userType, // Return the user type (worker, admin, student)
        });
      })
      .catch(err => {
        // In case of any error during deciding user type
        return res.status(500).json({ error: err });
      });
  } else {
    return res.status(400).json({ error: "Invalid OTP" });
  }
});



// Update student attendance
app.put('/students/:rollNumber', (req, res) => {
  const rollNumber = req.params.rollNumber;

  db.query(
    'INSERT INTO attendance (rollNo, date) VALUES (?, NOW())',
    [rollNumber],
    (err, results) => {
      if (err) {
        res.status(500).json({ error: 'Error updating attendance' });
      } else {
        res.json({ message: 'Attendance updated successfully' });
      }
    }
  );
});
// Fetch attendance times for a student on the current day
app.post('/students/attendance', (req, res) => {
  const { rollNumber } = req.body;
  console.log(rollNumber)
  if (!rollNumber) {
    return res.status(400).json({ error: 'Roll number is required' });
  }

  const query = `
    SELECT DATE_FORMAT(date, '%H:%i:%s') AS time 
    FROM attendance 
    WHERE rollNo = ? AND DATE(date) = CURDATE()
  `;

  db.query(query, [rollNumber], (err, results) => {
    if (err) {
      return res.status(500).json({ error: 'Error fetching attendance times' });
    }

    res.json({ attendanceTimes: results.map(row => row.time) });
  });
});
// Start the server
app.listen(PORT, '0.0.0.0', () => {
  console.log(`Server is running on http://0.0.0.0:${PORT}`);
  console.log('Access this app on your local network using your system\'s local IP address:');
  console.log(`Example: http://192.168.92.27:${PORT}`);
});

