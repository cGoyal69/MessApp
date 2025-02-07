const express = require('express');
const mysql = require('mysql2');
const bodyParser = require('body-parser');
const nodemailer = require("nodemailer");
const cors = require('cors');

const app = express();
const PORT = 3000;


let otpStore = {}; // Store OTPs mtemporarily
const EMAIL_USER = "c92084860@gmail.com";
const EMAIL_PASS = "skby bqhs bizg jgbv";


// Middleware
app.use(bodyParser.json());
app.use(cors());

// MySQL Connection
const db = mysql.createConnection({
  host: 'messapp-cgoy96.b.aivencloud.com', // Replace with your MySQL host
  user: 'avnadmin',      // Replace with your MySQL username
  password: 'AVNS_AvANMiNmvDBnWSYkCF8', // Replace with your MySQL password
  database: 'mess',  // Replace with your MySQL database name
  port: 13099,
  waitForConnections: true,
  connectionLimit: 10,  // Adjust asb needed
  queueLimit: 0
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
    const istTime = new Date(new Date().getTime() + (3 * 60 * 60 * 1000))
    console.log(istTime)
    db.query(
      `SELECT COUNT(*) AS count 
       FROM attendance 
       WHERE rollNo = ? 
       AND date >= ? `,
      [rollNumber,istTime],
      (err, result) => {
        if (err) {
          return reject('Error checking attendance');
        }
        resolve(result[0].count > 0 ? 'Visited' : 'Pass');
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
  const istTime = new Date(new Date().getTime() + (5.5*60*60*1000)); // Convert to IST
  console.log("Student with rollNo:"+rollNumber+" found in "+preference+" mess.");
  try {
    db.query('SELECT * FROM users WHERE rollNo = ?',
      [rollNumber, preference],
      async (err, results) => {
        if (err) {
          console.log(err);
          return res.status(500).json({ error: 'Error fetching student data' });
        } else if (results.length === 0) {
          return res.status(404).json({ message: 'Student not found' });
        }
        else{
          const student = results[0];
          if (student.allowed != 1){
            console.log(student.name+' is debarded.');
            return res.status(405).json({ message: 'Student not allowed' });
          }
          else if(student.preference != preference){
            console.log(student.name+' Entering Wrong Mess.');
            db.query(
              'INSERT INTO fine (rollNo, date) VALUES (?, ?)',
              [rollNumber, istTime],
              (err, results) => {
                if (err) {
                  console.log('Error updating attendance' );
                } else {
                  console.log('Fine updated successfully' );
                }
              }
            );
            return res.status(405).json({ message: `Denied Student of ${student.preference} mess!` });
          }
          else{
            console.log(student, " verified entry.");
            const entryStatus = await attendanceCount(student.rollNo);
            return res.json({ student, entry: entryStatus });
          }
        }
      }
    );
  } catch (error) {
    res.status(500).json({ error: 'Error processing request' });
  }
});

app.post('/students/gets', async (req, res) => {
  const { rollNo } = req.body;
  console.log(rollNo+" searched by admin.");
  try {
    db.query(
      'SELECT * FROM users WHERE rollNo = ?',
      [rollNo],
      async (err, results) => {
        if (err) {
          console.log(err);
          return res.status(500).json({ error: 'Error fetching student data' });
        } else if (results.length === 0) {
          console.log(err);
          return res.status(404).json({ message: 'Student not found' });
        }
        const student = results[0];
        console.log(student+" to admin page.");
        const entryStatus = await attendanceCount(student.rollNo);
        res.json({ student, entry: entryStatus });
      }
    );
  } catch (error) {
    res.status(500).json({ error: 'Error processing request' });
  }
});

app.post('/getRemain', async (req, res) => {
  const { preference } = req.body;
  const istTime = new Date(new Date().getTime() + (3 * 60 * 60 * 1000))
  try {
    db.query(
      'SELECT count(*) as scannedCount FROM users, attendance WHERE date >= ? and users.rollNo = attendance.rollNo and users.preference = ?',
      [istTime, preference],
      async (err, results) => {
        if (err) {
          console.log(err);
          return res.status(500).json({ error: 'Error fetching student data' });
        } else if (results.length === 0) {
          console.log(err);
          return res.status(404).json({ message: 'Student not found' });
        }
        const scannedCount = results[0];
        res.json({ scannedCount});
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
  const query = 'INSERT INTO users (name, email, rollNo, preference, photo, allowed) VALUES (?, ?, ?, ?, ?, 1)';
  db.query(query, [name, email, rollNo, preference, photo], (err, result) => {
    if (err) {
      console.log(`${name}, ${rollNo} not added.`);
      return res.status(500).json({ error: 'Error adding user' });
    }
    console.log(`${name}, ${rollNo} added.`);
    res.status(201).json({ success: 'User added successfully', userId: result.insertId });
  });
});
// Update an existing user (only email and preference can be updated)
// Update student details by roll number
app.put('/students/update', (req, res) => {
  const { rollNo, name, email, preference } = req.body;
  console.log('Data of'+rollNo+name+" to update.");
  if (!rollNo) {
    return res.status(400).json({ error: 'Roll No is required' });
  }
  const query = 'UPDATE users SET name = ?, email = ?, preference = ? WHERE rollNo = ?';
  db.query(query, [name, email, preference, rollNo], (err, result) => {
    if (err) {
      return res.status(500).json({ error: 'Error updating student' });
    }
    if (result.affectedRows === 0) {
      return res.status(404).json({ message: 'Student not found' });
    }
    
    // Fetch the updated student details
    const fetchQuery = 'SELECT * FROM users WHERE rollNo = ?';
    db.query(fetchQuery, [rollNo], (err, updatedResults) => {
      if (err) {
        return res.status(500).json({ error: 'Error fetching updated student details' });
      }
      res.status(200).json({ message: 'Student updated successfully', student: updatedResults[0] });
    });
  });
});
// Delete a user by roll number (from body)
app.put('/update_allowed_status', (req, res) => {
  const { rollNo, allowed } = req.body;

  if (!rollNo) {
    return res.status(400).json({ error: 'Roll number is required' });
  }

  const query = 'UPDATE users set allowed=? WHERE rollNo = ?';
  db.query(query,  [allowed, rollNo], (err, result) => {
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
  console.log(email, otp);
  // Check if email and otp are provided
  if (!email || !otp) {
    return res.status(400).json({ error: "Email and OTP are required" });
  }

  // Check if OTP is valid for the email
  if (otpStore[email] && otpStore[email] === otp) {
    delete otpStore[email]; // OTP should be used only once

    // Now, call decideUser function to get the user type based on preference
    decideUser(email).then(userType => {
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
  const istTime = new Date(new Date().getTime() + (5.5*60*60*1000)) // Convert to IST

  db.query(
    'INSERT INTO attendance (rollNo, date) VALUES (?, ?)',
    [rollNumber, istTime],
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

// Get total students and count veg/non-veg
app.get('/mess/stats', async (req, res) => {
  try {
    const query = `
    SELECT preference, COUNT(*) as count FROM users GROUP BY preference
  `;

  db.query(query, (err, results) => {
    if (err) {
      return res.status(500).json({ error: 'Error fetching attendance times' });
    }

    res.json(results);
  })
  } catch (err) {
    res.status(500).json({ error: 'Error fetching mess stats', details: err.message });
  }
});

// Search student by roll number


// Remove student by roll number
app.delete('/students/remove', (req, res) => {
  const { rollNo } = req.body;
  if (!rollNo) {
    return res.status(400).json({ error: 'Roll No is required' });
  }

  const query = 'DELETE FROM users WHERE rollNo = ?';
  db.query(query, [rollNo], (err, result) => {
    if (err) {
      return res.status(500).json({ error: 'Error removing student' });
    }
    if (result.affectedRows === 0) {
      return res.status(404).json({ message: 'Student not found' });
    }
    res.status(200).json({ success: 'Student removed successfully' });
  });
});
// Start the server
app.listen(PORT, '0.0.0.0', () => {
  console.log(`Server is running on http://0.0.0.0:${PORT}`);
  console.log('Access this app on your local network using your system\'s local IP address:');
  console.log(`Example: http://192.168.29.110:${PORT}`);
});

