# 3-minute demo script

Run `npm run dev`, open the app. Everything below works offline in mock mode; with AWS deployed, the same steps use real Textract, S3, DynamoDB and SES.

| Time | Do | Say |
|---|---|---|
| 0:00 | Landing page | "India's rooftop solar subsidy is real money, but families stall at the paperwork. ChhatReady turns your electricity bill into a plan and the application pack." |
| 0:20 | Upload bill (or **Try a sample bill**) | "A photo of the bill. Textract reads it." |
| 0:40 | Review screen | "Nothing is trusted blindly. Every value shows its confidence and where it came from on the bill. I confirm or fix." |
| 1:00 | Roof: **Use sample roof** | "I outline the roof on the map. We subtract obstructions." |
| 1:15 | **Plan** (hero) | "2.5 kW. I pay about ₹88,500 after ₹69,000 subsidy, it pays back in 3.7 years, my bill falls from ₹2,413 to ₹362. Drag the slider: cost, subsidy and payback move live." |
| 1:50 | **How we calculated this** | "No AI in the numbers. Plain arithmetic, every assumption editable, subsidy rule dated and sourced." |
| 2:05 | **Application pack** | "A 4-page PDF: my plan, the six portal steps with my details filled in, documents, and an installer spec sheet." |
| 2:20 | Email / RFQ | "I can email it to myself or send the quote request to real installers I choose. One message each, replies come to me." |
| 2:40 | **Check a quote** (sample quote) | "An installer quotes ₹2,25,000 for 3 kW. We flag it above the typical range and that it never mentions subsidy-eligible modules, with questions to ask." |
| 2:55 | Close | "Advice you can act on today. Deploys with one CDK command." |
