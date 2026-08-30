# Job Finder

Rank live job listings against **your** requirements — role, skills, location, seniority, salary, must-haves, and deal-breakers.

Boards searched (no API keys):

- [Remotive](https://remotive.com)
- [Remote OK](https://remoteok.com)
- [Jobicy](https://jobicy.com)
- [Arbeitnow](https://www.arbeitnow.com)
- [The Muse](https://www.themuse.com)

Each listing is scored and tagged with why it matches and what’s missing. Apply links go back to the original board.

## Run it

```bash
cd "/mnt/c/Users/Shoaib Qazi/Desktop/Ai/job-finder"
npm install
npm run dev
```

Windows Explorer: `C:\Users\Shoaib Qazi\Desktop\Ai\job-finder`

Open [http://127.0.0.1:3001](http://127.0.0.1:3001).

1. Type a target role, or click a preset (Frontend, Backend, Full stack, Data, Design).
2. Add skills, location, work mode, level, and optional min salary.
3. Add must-haves and deal-breakers.
4. Optionally paste a resume or brief and click **Fill form from text**.
5. Click **Find matching jobs**.

Requirements and saved jobs stay in this browser (`localStorage`).

## How matching works

| Signal        | Weight | Notes                                      |
|---------------|--------|--------------------------------------------|
| Title         | 28     | Phrase and keyword overlap                 |
| Skills        | 26     | Tags + description                         |
| Location/mode | 14     | Remote / hybrid / on-site + city           |
| Job type      | 8      | Full-time, contract, etc.                  |
| Seniority     | 8      | Intern → lead, inferred from the title     |
| Salary        | 8      | When the board publishes pay               |
| Must-haves    | 8      | Missing must-haves cut the score sharply   |

Deal-breakers drop the listing entirely.

## Notes

- Sources are public feeds. Credit goes to the original board; apply buttons use their URLs.
- Results are cached in memory for 3 minutes per unique brief so repeat searches stay snappy.
- These boards lean remote / tech. Local government or LinkedIn-only roles will not appear.
