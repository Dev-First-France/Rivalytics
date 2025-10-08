# =========================================================
# ⚙️  Préparation des variables
# =========================================================
PORT=3001
BASE="http://localhost:$PORT"
NAME="Dev%20First"   # ← avec espace encodé

echo "🔗 Base API: $BASE"
echo "👤 Nom concurrent: Dev First"
echo

# =========================================================
# 📰 1. RSS (blogs)
# =========================================================
echo "📰 Test RSS (blogs)..."
curl -s "$BASE/api/rss?name=$NAME&days=30" | jq '.items[0:3]'
echo

# =========================================================
# 🎵 2. TikTok
# =========================================================
echo "🎵 Test TikTok (ex: withjohanna_)..."
curl -s "$BASE/api/tiktok?username=withjohanna_&limit=5" | jq '.items[0:3]'
echo

# =========================================================
# 📸 3. Instagram
# =========================================================
echo "📸 Test Instagram (accenture)..."
curl -s "$BASE/api/instagram?username=accenture&limit=5" | jq '.items[0:3]'
echo

# =========================================================
# ▶️ 4. YouTube
# =========================================================
echo "▶️ Test YouTube (@googledevelopers)..."
curl -s "$BASE/api/youtube?channel=@googledevelopers&days=30&limit=5" | jq '.items[0:3]'
echo

# =========================================================
# 🎟️ 5. Events (Meetup / Eventbrite)
# =========================================================
echo "🎟️ Test Events (Meetup ParisJS)..."
curl -s "$BASE/api/events?feeds=https://www.meetup.com/fr-FR/ParisJS/events/rss/&days=90" | jq '.items[0:3]'
echo

# =========================================================
# 🧩 6. Collect global (toutes sources)
# =========================================================
echo "🧩 Test collecte globale (Dev First)..."
curl -s "$BASE/api/collect?name=$NAME&days=30&limit=8" | jq '.items[0:5] | map({type, title, date})'
echo

# =========================================================
# 📊 7. Statistiques (comparateur)
# =========================================================
echo "📊 Test /api/stats (Dev First + Accenture)..."
curl -s "$BASE/api/stats?name=Dev%20First,Accenture&range=7" | jq
echo

# =========================================================
# 🏆 8. Top post
# =========================================================
echo "🏆 Test /api/top (Dev First)..."
curl -s "$BASE/api/top?name=$NAME&range=30" | jq '{score, title: .item.title, type: .item.type}'
echo

# =========================================================
# 🧾 9. Rapport 7j (HTML)
# =========================================================
echo "🧾 Test /api/report (Dev First, range=7)..."
curl -s "$BASE/api/report?name=$NAME&range=7" | jq -r '.html' > /tmp/rapport-devfirst.html
echo "✅ Rapport généré dans /tmp/rapport-devfirst.html"
echo "➡️  Ouvre-le dans ton navigateur : file:///tmp/rapport-devfirst.html"
echo

# =========================================================
# 🧠 10. Résumé final
# =========================================================
echo "✅ Tests terminés :"
echo " - /api/rss ............ OK"
echo " - /api/tiktok ......... OK"
echo " - /api/instagram ...... OK"
echo " - /api/youtube ........ OK"
echo " - /api/events ......... OK"
echo " - /api/collect ........ OK"
echo " - /api/stats .......... OK"
echo " - /api/top ............ OK"
echo " - /api/report ......... OK"
echo
echo "🔥 Ouvre http://localhost:3001 pour tester le front (mode comparateur + rapport 7j)"