export default function Privacy() {
  const h = 'font-display text-2xl mt-8';
  return (
    <div className="container-page max-w-3xl py-10">
      <h1 className="font-display text-4xl">Privacy</h1>
      <p className="mt-3 text-lg text-ink/85">ChhatReady is a hackathon prototype. Here is exactly what it keeps and for how long.</p>

      <h2 className={h}>What we store</h2>
      <ul className="mt-2 list-disc space-y-1.5 pl-6 text-ink/85">
        <li>Your bill photo or PDF. It is deleted automatically after one to two days, or straight away if you delete your plan.</li>
        <li>The values you confirm (units, amount, sanctioned load, DISCOM, consumer number), your roof area and location, and the plan we calculate.</li>
        <li>The application pack PDF, deleted automatically after about a week.</li>
        <li>The addresses you send an email or quote request to, and when.</li>
      </ul>

      <h2 className={h}>How long</h2>
      <p className="mt-2 text-ink/85">Plans expire about 30 days after your last change. There are no accounts. Your plan link is a long random code that only you have.</p>

      <h2 className={h}>Delete it now</h2>
      <p className="mt-2 text-ink/85">Open your plan, go to the last step and choose Delete my data. Your plan, uploads and pack are removed straight away.</p>

      <h2 className={h}>Sharing</h2>
      <p className="mt-2 text-ink/85">The share link shows your plan numbers but hides your consumer number, your exact location and your application pack.</p>

      <h2 className={h}>Reading your bill</h2>
      <p className="mt-2 text-ink/85">Your file is sent to Amazon Textract to read the text. It is processed in the AWS Mumbai region (ap-south-1) by default. Calculations are plain arithmetic in our own code. No AI model makes up numbers about your home.</p>

      <h2 className={h}>Emails</h2>
      <p className="mt-2 text-ink/85">Quote requests go only to the installers you type in, one message each, with replies coming to you. We never include your consumer number. We do not email anyone else.</p>
    </div>
  );
}
