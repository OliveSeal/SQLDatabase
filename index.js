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

    await db.run("INSERT INTO users (firstname, lastname, email, password) VALUES (?, ?, ?, ?)", fname, lname, email, passwordHash);
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
    res.redirect('home.ejs');
});