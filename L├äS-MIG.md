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
