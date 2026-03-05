import requests
from django.shortcuts import render, redirect
from django.contrib import messages
from django.conf import settings

API_URL = getattr(settings, "API_URL", "http://localhost:3000")
KEYCLOAK_URL = getattr(settings, "KEYCLOAK_URL", "http://localhost:8080")
KEYCLOAK_REALM = getattr(settings, "KEYCLOAK_REALM", "recette-realm")
CLIENT_ID = getattr(settings, "KEYCLOAK_CLIENT_ID", "recette-django")
CLIENT_SECRET = getattr(settings, "KEYCLOAK_CLIENT_SECRET", "your-django-secret")
REDIRECT_URI = getattr(settings, "KEYCLOAK_REDIRECT_URI", "http://localhost:8000/auth/callback/")


def get_auth_headers(request):
    token = request.session.get("access_token")
    if token:
        return {"Authorization": f"Bearer {token}"}
    return {}


def is_authenticated(request):
    return bool(request.session.get("access_token"))


def recette_list(request):
    query = request.GET.get("q", "")
    category = request.GET.get("category", "")
    params = {}
    if query:
        params["q"] = query
    if category:
        params["category"] = category
    try:
        response = requests.get(f"{API_URL}/recipes", params=params, timeout=5)
        response.raise_for_status()
        recettes = response.json()
    except requests.RequestException:
        recettes = []
        messages.error(request, "Impossible de contacter l'API.")
    return render(request, "RecetteApp/recette_list.html", {
        "recettes": recettes,
        "query": query,
        "category": category,
        "is_authenticated": is_authenticated(request),
    })


def recette_detail(request, pk):
    try:
        response = requests.get(f"{API_URL}/recipes/{pk}", timeout=5)
        response.raise_for_status()
        recette = response.json()
    except requests.RequestException:
        recette = None
        messages.error(request, "Recette introuvable.")

    try:
        reviews_response = requests.get(f"{API_URL}/recipes/{pk}/reviews", timeout=5)
        reviews = reviews_response.json()
        avg_rating = round(sum(r["rating"] for r in reviews) / len(reviews)) if reviews else 0
    except requests.RequestException:
        reviews = []
        avg_rating = 0

    return render(request, "RecetteApp/recette_detail.html", {
        "recette": recette,
        "reviews": reviews,
        "avg_rating": avg_rating,
        "is_authenticated": is_authenticated(request),
    })


def recette_create(request):
    if not is_authenticated(request):
        messages.warning(request, "Vous devez être connecté pour ajouter une recette.")
        return redirect("login")
    if request.method == "POST":
        data = {
            "title": request.POST.get("title"),
            "category": request.POST.get("category"),
            "preparation_time": request.POST.get("preparation_time"),
            "ingredients": request.POST.get("ingredients"),
            "steps": request.POST.get("steps"),
            "portions": request.POST.get("portions"),
            "difficulty": request.POST.get("difficulty"),
            "utensils": request.POST.get("utensils"),
            "image": request.POST.get("image"),
        }
        try:
            response = requests.post(
                f"{API_URL}/recipes",
                json=data,
                headers=get_auth_headers(request),
                timeout=5,
            )
            if response.status_code == 201:
                messages.success(request, "Recette ajoutée avec succès !")
                return redirect("recette_list")
            else:
                messages.error(request, f"Erreur API : {response.json().get('message')}")
        except requests.RequestException:
            messages.error(request, "Impossible de contacter l'API.")
    return render(request, "RecetteApp/recette_form.html", {
        "action": "Ajouter",
        "is_authenticated": is_authenticated(request),
    })


def recette_edit(request, pk):
    if not is_authenticated(request):
        messages.warning(request, "Vous devez être connecté pour modifier une recette.")
        return redirect("login")
    try:
        response = requests.get(f"{API_URL}/recipes/{pk}", timeout=5)
        recette = response.json()
    except requests.RequestException:
        recette = {}
    if request.method == "POST":
        data = {
            "title": request.POST.get("title"),
            "category": request.POST.get("category"),
            "preparation_time": request.POST.get("preparation_time"),
            "ingredients": request.POST.get("ingredients"),
            "steps": request.POST.get("steps"),
            "portions": request.POST.get("portions"),
            "difficulty": request.POST.get("difficulty"),
            "utensils": request.POST.get("utensils"),
            "image": request.POST.get("image"),
        }
        try:
            response = requests.put(
                f"{API_URL}/recipes/{pk}",
                json=data,
                headers=get_auth_headers(request),
                timeout=5,
            )
            if response.status_code == 200:
                messages.success(request, "Recette modifiée avec succès !")
                return redirect("recette_detail", pk=pk)
            else:
                messages.error(request, f"Erreur API : {response.json().get('message')}")
        except requests.RequestException:
            messages.error(request, "Impossible de contacter l'API.")
    return render(request, "RecetteApp/recette_form.html", {
        "action": "Modifier",
        "recette": recette,
        "is_authenticated": is_authenticated(request),
    })


def recette_delete(request, pk):
    if not is_authenticated(request):
        messages.warning(request, "Vous devez être connecté pour supprimer une recette.")
        return redirect("login")
    if request.method == "POST":
        try:
            requests.delete(
                f"{API_URL}/recipes/{pk}",
                headers=get_auth_headers(request),
                timeout=5,
            )
            messages.success(request, "Recette supprimée.")
        except requests.RequestException:
            messages.error(request, "Impossible de contacter l'API.")
    return redirect("recette_list")


def recette_reviews(request, pk):
    if not is_authenticated(request):
        messages.warning(request, "Vous devez être connecté pour laisser un avis.")
        return redirect("login")
    if request.method == "POST":
        data = {
            "rating": request.POST.get("rating"),
            "comment": request.POST.get("comment"),
            "author": request.POST.get("author", "Anonyme"),
        }
        try:
            response = requests.post(
                f"{API_URL}/recipes/{pk}/reviews",
                json=data,
                headers=get_auth_headers(request),
                timeout=5,
            )
            if response.status_code == 201:
                messages.success(request, "Avis ajouté avec succès !")
            else:
                messages.error(request, f"Erreur : {response.json().get('message')}")
        except requests.RequestException:
            messages.error(request, "Impossible de contacter l'API.")
    return redirect("recette_detail", pk=pk)


def recette_review_delete(request, pk, review_id):
    if not is_authenticated(request):
        return redirect("login")
    if request.method == "POST":
        try:
            requests.delete(
                f"{API_URL}/recipes/{pk}/reviews/{review_id}",
                headers=get_auth_headers(request),
                timeout=5,
            )
            messages.success(request, "Avis supprimé.")
        except requests.RequestException:
            messages.error(request, "Impossible de contacter l'API.")
    return redirect("recette_detail", pk=pk)


def login_view(request):
    import secrets
    import hashlib
    import base64
    code_verifier = secrets.token_urlsafe(64)
    code_challenge = base64.urlsafe_b64encode(
        hashlib.sha256(code_verifier.encode()).digest()
    ).rstrip(b"=").decode()
    request.session["code_verifier"] = code_verifier
    auth_url = (
        f"{KEYCLOAK_URL}/realms/{KEYCLOAK_REALM}/protocol/openid-connect/auth"
        f"?client_id={CLIENT_ID}"
        f"&response_type=code"
        f"&redirect_uri={REDIRECT_URI}"
        f"&scope=openid profile email"
        f"&code_challenge={code_challenge}"
        f"&code_challenge_method=S256"
    )
    return redirect(auth_url)


def auth_callback(request):
    code = request.GET.get("code")
    code_verifier = request.session.pop("code_verifier", None)
    if not code or not code_verifier:
        messages.error(request, "Erreur d'authentification.")
        return redirect("recette_list")
    try:
        token_url = f"{KEYCLOAK_URL}/realms/{KEYCLOAK_REALM}/protocol/openid-connect/token"
        response = requests.post(token_url, data={
            "grant_type": "authorization_code",
            "client_id": CLIENT_ID,
            "client_secret": CLIENT_SECRET,
            "code": code,
            "redirect_uri": REDIRECT_URI,
            "code_verifier": code_verifier,
        }, timeout=10)
        response.raise_for_status()
        tokens = response.json()
        request.session["access_token"] = tokens["access_token"]
        request.session["refresh_token"] = tokens.get("refresh_token")
        messages.success(request, "Connexion reussie !")
    except requests.RequestException as e:
        messages.error(request, f"Erreur lors de la connexion : {e}")
    return redirect("recette_list")


def logout_view(request):
    request.session.flush()
    messages.info(request, "Vous etes deconnecte.")
    return redirect("recette_list")