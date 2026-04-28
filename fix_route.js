const fs = require('fs');
let code = fs.readFileSync('index.js', 'utf8');
if (!code.includes("app.use('/image', express.static('image'));")) {
    code = code.replace(
        "app.use(express.static('public'));",
        "app.use(express.static('public'));\napp.use('/image', express.static('image'));"
    );
    fs.writeFileSync('index.js', code, 'utf8');
    console.log('Added image static route');
} else {
    console.log('Image route already exists');
}
