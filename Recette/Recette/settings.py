"""
Django settings for Recette project.
"""
import os
import hvac
from pathlib import Path

# ─── Chemins ──────────────────────────────────────────────────────────────────
BASE_DIR = Path(__file__).resolve().parent.parent

# ─── Vault / Secrets ──────────────────────────────────────────────────────────
def get_vault_secrets():
    try:
        client = hvac.Client(
            url=os.environ.get("VAULT_ADDR", "http://127.0.0.1:8200"),
            token=os.environ.get("VAULT_TOKEN", "")
        )
        secret = client.secrets.kv.read_secret_version(path="recette-api")
        print("Secrets Django chargés depuis Vault ✅")
        return secret["data"]["data"]
    except Exception as e:
        print(f"Vault non disponible : {e}")
        return {}

vault_secrets = get_vault_secrets()

# ─── Sécurité ─────────────────────────────────────────────────────────────────
SECRET_KEY = vault_secrets.get(
    "DJANGO_SECRET_KEY",
    os.environ.get("DJANGO_SECRET_KEY", "django-insecure-a5&d@$41*n1wp1$ey2fsi-(1t%9iwdzh*7)!-te5vb8cu-j6)p")
)

DEBUG = os.environ.get("DEBUG", "True") == "True"
ALLOWED_HOSTS = os.environ.get("ALLOWED_HOSTS", "localhost,127.0.0.1").split(",")

# ─── Applications ─────────────────────────────────────────────────────────────
INSTALLED_APPS = [
    'django.contrib.admin',
    'django.contrib.auth',
    'django.contrib.contenttypes',
    'django.contrib.sessions',
    'django.contrib.messages',
    'django.contrib.staticfiles',
    'RecetteApp',
]

# ─── Middleware ───────────────────────────────────────────────────────────────
MIDDLEWARE = [
    'django.middleware.security.SecurityMiddleware',
    'whitenoise.middleware.WhiteNoiseMiddleware',
    'django.contrib.sessions.middleware.SessionMiddleware',
    'django.middleware.common.CommonMiddleware',
    'django.middleware.csrf.CsrfViewMiddleware',
    'django.contrib.auth.middleware.AuthenticationMiddleware',
    'django.contrib.messages.middleware.MessageMiddleware',
    'django.middleware.clickjacking.XFrameOptionsMiddleware',
]

ROOT_URLCONF = 'Recette.urls'

TEMPLATES = [
    {
        'BACKEND': 'django.template.backends.django.DjangoTemplates',
        'DIRS': [],
        'APP_DIRS': True,
        'OPTIONS': {
            'context_processors': [
                'django.template.context_processors.request',
                'django.contrib.auth.context_processors.auth',
                'django.contrib.messages.context_processors.messages',
            ],
        },
    },
]

WSGI_APPLICATION = 'Recette.wsgi.application'

# ─── Base de données ──────────────────────────────────────────────────────────
DATABASES = {
    'default': {
        'ENGINE': 'django.db.backends.sqlite3',
        'NAME': BASE_DIR / 'db.sqlite3',
    }
}

# ─── Validation mots de passe ─────────────────────────────────────────────────
AUTH_PASSWORD_VALIDATORS = [
    {'NAME': 'django.contrib.auth.password_validation.UserAttributeSimilarityValidator'},
    {'NAME': 'django.contrib.auth.password_validation.MinimumLengthValidator'},
    {'NAME': 'django.contrib.auth.password_validation.CommonPasswordValidator'},
    {'NAME': 'django.contrib.auth.password_validation.NumericPasswordValidator'},
]

# ─── Internationalisation ─────────────────────────────────────────────────────
LANGUAGE_CODE = 'fr-fr'
TIME_ZONE = 'Europe/Paris'
USE_I18N = True
USE_TZ = True

# ─── Fichiers statiques ───────────────────────────────────────────────────────
STATIC_URL = 'static/'
STATIC_ROOT = BASE_DIR / 'staticfiles'
STATICFILES_STORAGE = 'whitenoise.storage.CompressedManifestStaticFilesStorage'

# ─── Clé primaire par défaut ──────────────────────────────────────────────────
DEFAULT_AUTO_FIELD = 'django.db.models.AutoField'

# ─── API & Keycloak ───────────────────────────────────────────────────────────
API_URL = vault_secrets.get("API_URL", os.environ.get("API_URL", "http://localhost:3000"))
KEYCLOAK_URL = vault_secrets.get("KEYCLOAK_URL", os.environ.get("KEYCLOAK_URL", "http://localhost:8080"))
KEYCLOAK_REALM = vault_secrets.get("KEYCLOAK_REALM", os.environ.get("KEYCLOAK_REALM", "recette-realm"))
KEYCLOAK_CLIENT_ID = vault_secrets.get("KEYCLOAK_CLIENT_ID", os.environ.get("KEYCLOAK_CLIENT_ID", "recette-django"))
KEYCLOAK_CLIENT_SECRET = vault_secrets.get("KEYCLOAK_CLIENT_SECRET", os.environ.get("KEYCLOAK_CLIENT_SECRET", ""))
KEYCLOAK_REDIRECT_URI = vault_secrets.get("KEYCLOAK_REDIRECT_URI", os.environ.get("KEYCLOAK_REDIRECT_URI", "http://localhost:8000/auth/callback/"))