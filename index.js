import express from 'express';
import session from 'express-session';
import { open } from "sqlite";
import sqlite3 from 'sqlite3'
import bcrypt from 'bcrypt'

const dbPromise = open({
    filename: 'Database.db',
    driver: sqlite3.Database
});

const app = express();
const port = 3000;

app.use(session({
    secret: 'secret',
    resave: true,
    saveUninitialized: true
}));

app.use(express.static('public'));
app.set('view engine', 'ejs');
app.use(express.urlencoded({ extended: true }));


// Routes will be added here

app.listen(port, () => {
    console.log(`Server er startet her: http://localhost:${port}`);
});

app.get('/', (req, res) => {
    res.render('login');
});

app.get("/register", async (req, res) => {
    res.render("register");
})

app.post("/register", async (req, res) => {
    const db = await dbPromise;

    const { fname, lname, email, password, passwordRepeat } = req.body;

    if (password != passwordRepeat) {
        res.render("register", { error: "Password must match." })
        return;
    }
    const passwordHash = await bcrypt.hash(password, 10);

    // Inserting user data into the database and getting the last inserted row ID
    const result = await db.run("INSERT INTO users (firstname, lastname, email, password) VALUES (?, ?, ?, ?)", fname, lname, email, passwordHash);
    const userId = result.lastID;

    res.redirect("/");
})


app.post('/auth', async function (req, res) {

    const db = await dbPromise;

    const { email, password } = req.body;
    let getUserDetails = `SELECT * FROM users WHERE email = '${email}'`;
    let checkInDb = await db.get(getUserDetails);
    if (checkInDb === undefined) {
        res.status(400);
        res.send("Invalid user" + getUserDetails);
    } else {
        const isPasswordMatched = await bcrypt.compare(
            password,
            checkInDb.password
        );

        if (isPasswordMatched) {
            res.status(200);
            if (checkInDb.role == 1) {
                req.session.admin = true;
            }
            // If the account exists
            // Authenticate the user
            req.session.loggedin = true;
            req.session.email = email;
            // Redirect to home page
            res.redirect('/home');
        } else {
            res.status(400);
            res.send("Invalid password");
            res.redirect("/");
        }

    }

});

// http://localhost:3000/home
app.get('/home', function (req, res) {
    // If the user is loggedin
    if (req.session.loggedin) {
        // Output username
        const user = req.session.email;  
        const admin = req.session.admin;
        res.render('home', {user, admin}); 
    } else {
        // Not logged in
        res.send('Please login to view this page!');
    }
});

app.post('/products', async (req, res) => {
    const { category } = req.body;
    const db = await dbPromise;

    const query = 'SELECT * FROM products WHERE category = ?';
    const products = await db.all(query, [category]);

    res.render('products', { products });

});

app.get("/logout", async (req, res) => {
   
    req.session.loggedin = false;
    req.session.username = '';
    req.session.admin = false;
    res.redirect("/")
})

app.get('/admin', async function (req, res) {
    if (req.session.loggedin) {
        const user = req.session.email;
        const db = await dbPromise;
        let getUserDetails = `SELECT * From users WHERE email = '${user}' AND role = 1`;
        let checkInDb = await db.get(getUserDetails);
        const query = 'SELECT * FROM users';
        const users = await db.all(query);

        if (checkInDb === undefined) {
            res.status(400);
            res.send("Invalid user")
        } else {
            let admin = true;
            res.status(200);
            res.render('admin', {user, admin, users});
        }
    }
});

// Add this route to your existing Node.js script
app.get('/home', function (req, res) {
    // If the user is loggedin
    if (req.session.loggedin) {
        // Render the create post form
        res.render('home');
    } else {
        // If user is not logged in, redirect to login page
        res.redirect('/');
    }
});

app.post('/home', async function (req, res) {
    // Ensure user is logged in
    if (!req.session.loggedin) {
      // If user is not logged in, redirect to login page
      return res.redirect('/');
    }
  
    const { title, content } = req.body;
    const db = await dbPromise;
  
    // Insert the post data into the database
    await db.run('INSERT INTO posts (title, content) VALUES (?, ?)', [title, content]);
  
    // Redirect user to the home page or show a success message
    res.redirect('/home'); // Corrected redirection path
  });
  
  app.get('/home', async function (req, res) {
    try {
        // If the user is logged in
        if (req.session.loggedin) {
            // Output username
            const user = req.session.email;
            const db = await dbPromise;
            const query = 'SELECT title, content FROM posts';
            const posts = await db.all(query);
            
            // Render the home page template with the posts
            res.render('home', { posts });
        } else {
            // If user is not logged in, redirect to login page or send an error message
            res.send('Please login to view this page!');
            // or redirect to login page: res.redirect('/');
        }
    } catch (error) {
        console.error('Error fetching posts:', error);
        res.status(500).send('Internal Server Error');
    }
});

// GET route for admin edit page
app.get('/admin/edit/:email', async function (req, res) {
    const admin = req.session.admin;

    if (admin) {
        const db = await dbPromise;
        const email = req.params.email;
        const query = `SELECT * FROM users WHERE email='${email}'`;

        try {
            console.log("Query:", query); // Log the query to verify its correctness
            const user = await db.get(query);
            console.log("User:", user); // Log the user object to see if it's retrieved
            if (!user) {
                res.status(400).send("Invalid user");
            } else {
                res.status(200).render('edit', { user, admin });
            }
        } catch (error) {
            console.error('Error when retrieving user:', error);
            res.status(500).send("Internal Server Error");
        }
    } else {
        res.status(400).send("Not admin");
    }
});

// POST route to handle edits
app.post('/admin/edit/:email', async function (req, res) {
    const admin = req.session.admin;
    
    if (admin) {
        const email = req.params.email;
        const updateData = req.body;
        const db = await dbPromise;
        const fields = Object.keys(updateData).map(field => `${field} = ?`).join(", ");
        const values = Object.values(updateData);
        values.push(email);
        
        const query = `UPDATE users SET ${fields} WHERE email = ?`;

        try {
            const result = await db.run(query, values);
            console.log(result.changes + " record(s) updated");
            res.redirect('/admin');
        } catch (error) {
            console.error('Error when updating:', error);
            res.status(500).send("Internal Server Error");
        }
    } else {
        res.status(400).send("Not authorized");
    }
});

// Rute for å håndtere POST-forespørsler til '/admin/delete/:id'.
app.post('/admin/delete/:email', async (req, res) => {
    const email = req.params.email;  // Henter e-posten fra URL-parameteren.
    const db = await dbPromise; // Venter på at databasetilkoblingen skal være klar.
    const query = 'DELETE FROM users WHERE email = ?';
    
    try {
        await db.run(query, email); // Utfører sletting av brukeren fra databasen basert på e-post.
        console.log('Deleted user with email:', email); // Logger e-posten til brukeren som ble slettet.
        res.redirect('/admin');  // Omdirigerer tilbake til admin-siden etter sletting.
    } catch (error) {
        console.error('Error when deleting:', error); // Logger eventuelle feil under sletting.
        res.status(500).send("Unable to delete user.");  // Sender feilmelding hvis sletting feiler.
    }
});