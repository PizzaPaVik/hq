# HQ – så kommer du igång (ca 15 minuter, 0 kr)

Appen fungerar direkt utan konto, men då sparas allt bara på den enhet du använder.
Följ stegen nedan en gång så synkas iPhone och dator automatiskt.

## 1. Skapa databasen (Supabase, gratis)
1. Gå till **supabase.com** → *Start your project* → logga in med GitHub eller e-post.
2. *New project*. Välj ett namn (t.ex. `hq`), ett databaslösenord och region **North EU (Stockholm)**. Välj gratisplanen.
3. När projektet är klart: öppna **SQL Editor → New query**, klistra in hela innehållet i `supabase.sql` och tryck **Run**.
4. Öppna **Project Settings → API** och kopiera **Project URL** och **anon public key**.
5. Klistra in dem i `config.js` (eller i appens Inställningar senare).

## 2. Lägg upp appen (GitHub Pages, gratis)
1. Gå till **github.com** → skapa konto om du inte har ett → **New repository** → namn `hq` → *Public* → *Create*.
2. Klicka **uploading an existing file** och dra in **alla filer och mappen `icons`** från den här mappen → *Commit changes*.
3. Gå till **Settings → Pages** → *Source: Deploy from a branch* → *Branch: main / (root)* → *Save*.
4. Efter någon minut finns appen på `https://DITT-ANVÄNDARNAMN.github.io/hq/`.
5. Tillbaka i Supabase: **Authentication → URL Configuration → Site URL** = din adress från punkt 4. (Då hamnar bekräftelselänken i mejlet rätt.)

## 3. Installera på iPhone
1. Öppna adressen i **Safari**.
2. Tryck på **Dela**-ikonen → **Lägg till på hemskärmen** → *Lägg till*.
3. Öppna HQ från hemskärmen → Inställningar (reglage-ikonen uppe till höger) → **Skapa konto**.
4. Bekräfta via mejlet och logga sedan in i appen.

## 4. Datorn
Öppna samma adress i Chrome eller Safari och logga in med samma konto.
I Chrome kan du installera den som app via ikonen i adressfältet.

---

**Kostnad:** GitHub Pages och Supabase gratisnivå = 0 kr. Gratisprojekt i Supabase pausas om de
inte används på en vecka – använder du appen regelbundet händer det inte, och ett pausat projekt
kan startas igen gratis med ett klick. Exportera gärna en säkerhetskopia ibland (Inställningar → Exportera).

**Snabbtillägg:** Tryck på + och skriv t.ex. `imorgon 14:00 ring leverantören #butik !`.
Datum, tid, `#butik` och `!` (hög prioritet) känns igen automatiskt. ⌘K / Ctrl+K söker på datorn.

**Uppdatera appen senare:** ladda upp de nya filerna till GitHub och ändra `VERSION` i `sw.js`,
så hämtar telefonen nya versionen vid nästa start.

---

# Jarvis i HQ (version 1.1)

Under **Butik → Jarvis** (och som ett kort på Idag) ser du Jarvis från datorn: veckans siffror, köpresan,
det som väntar på ditt ja, kommande kampanjer och vad agenterna har gjort. Du kan skriva uppdrag till Jarvis
och godkänna saker – datorn kör dem med Claude och svaret dyker upp under *Dina uppdrag*.

## Koppla ihop (en gång, ca 5 minuter)
1. **Ladda upp den nya versionen** till ditt `hq`-repo på GitHub: alla filer i den här mappen (samma sätt som
   förra gången, *Add file → Upload files*, skriv över de gamla). **Ladda inte upp config.js** om du har fyllt i dina Supabase-uppgifter i den på GitHub – den finns inte med i HQ-app-1.1.zip av den anledningen. Vänta en minut och öppna HQ – Inställningar
   ska visa **HQ 1.1.0** längst ner. (Står det 1.0.0: stäng appen helt och öppna igen.)
2. **Supabase → SQL Editor → New query**: klistra in hela `jarvis.sql` och tryck **Run**.
3. **I HQ**: Inställningar → *Jarvis på datorn* → **Koppla Jarvis på datorn**. Gör det gärna i HQ på datorn,
   så kan du kopiera raden direkt.
4. **På datorn**: klistra in raden i en terminal i vencare-mappen och tryck Enter. Den ser ut så här:
   `node .team/hq-sync.mjs koppla eyJ1cmwiOi…`
   Står det "Kopplad" är du klar.
5. Kör `Installera.cmd` i `.team` en gång till, så startar synken automatiskt när du loggar in på datorn.
   (Den startar också när du öppnar Vencare Team.)

## Bra att veta
- **Datorn måste vara igång** för att uppdrag ska köras. I HQ ser du "Datorn är igång" eller när den senast var det.
- Uppdrag körs med Claude i bakgrunden, ett i taget. Push, publicering, ändringar i Shopify, mejlutskick och
  annonsändringar blockeras alltid där – Jarvis förbereder dem och lägger dem under *Väntar på ditt ja*.
- Datorn har en egen nyckel som bara kommer åt Jarvis-raderna, inte resten av HQ. Byt den med *Ny kopplingskod*,
  eller ta bort den med *Koppla bort datorn*.
- Logg på datorn: `.team/logg/hq-sync.log`. Stoppa synken: `node .team/hq-sync.mjs stopp`.

---

# Vencare City på nätet (version 1.5)

Staden finns nu i HQ, så du kan ha den uppe på vilken dator som helst, till exempel skoldatorn, även när
huvuddatorn är avstängd. Öppna HQ → **Jarvis → Öppna Vencare City**, eller gå direkt till
`https://DITT-ANVÄNDARNAMN.github.io/hq/stad.html`. Logga in i HQ på den datorn först. Staden använder samma inloggning.
**Helskärm** uppe till höger, och skärmen hålls vaken så länge staden visas.

- **Agenterna och besluten** kommer från huvuddatorns senaste synk. Är den avstängd ser du läget som det var senast.
- **Nya ordrar firas live** inom cirka 10 sekunder, även när huvuddatorn är avstängd. Det kräver kopplingen nedan.
  Staden visar bara belopp, antal varor och tid, aldrig kundnamn, så den går bra att ha uppe offentligt.

## 1. Ladda upp den nya versionen
Ladda upp `index.html`, `app.js`, `sw.js`, `styles.css` och **den nya filen `stad.html`** till ditt `hq`-repo på GitHub, likadant som tidigare.
(Ladda inte upp `config.js` om den på GitHub redan har dina uppgifter.) Inställningar ska visa **HQ 1.5.0**.

## 2. Koppla live-ordrar (en gång, ca 5 minuter)
1. **Supabase → SQL Editor → New query**: klistra in hela `stad.sql` och tryck **Run**. Längst ner visas en
   **token**, funktionens egen nyckel. Den skapas automatiskt och behöver inte sparas någonstans mer.
2. **Supabase → Edge Functions → Deploy a new function → Via Editor**: namnge den `shopify-order`, ersätt koden med
   innehållet i `.team/supabase/functions/shopify-order/index.ts` och tryck **Deploy function**.
   Öppna funktionen → **Settings** → stäng av *Verify JWT* → Save.
3. **Shopify**: en webhook för **orders/create** (format JSON) till
   `https://DITT-PROJEKT.supabase.co/functions/v1/shopify-order?k=TOKEN`. Jarvis kan skapa den åt dig via
   Shopify-kopplingen. Eller gör det i Shopify-admin under Inställningar → Aviseringar → Webhooks.
4. **Testa:** lägg en testorder (eller vänta på nästa riktiga). Inom cirka 10 sekunder skjuter staden fyrverkeri.
   Testordrar visas som *Testorder* och räknas inte in i dagens siffror eller milstolpar.

Bara belopp, antal varor och tid sparas, aldrig kunduppgifter. Den som känner till adressen med nyckeln kan
skicka in låtsasordrar som bara syns som fyrverkeri i staden. Byt nyckel genom att ta bort raden i `stad_inst`,
köra `stad.sql` igen och uppdatera webhook-adressen.

Chipet **Live** i staden är grönt när allt är kopplat. Visar det **Live av**, klicka på det för en kort guide.
