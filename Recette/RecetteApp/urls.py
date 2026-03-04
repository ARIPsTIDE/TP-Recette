from django.urls import path
from . import views

urlpatterns = [
    path("", views.recette_list, name="recette_list"),
    path("recette/<int:pk>/", views.recette_detail, name="recette_detail"),
    path("recette/ajouter/", views.recette_create, name="recette_create"),
    path("recette/<int:pk>/modifier/", views.recette_edit, name="recette_edit"),
    path("recette/<int:pk>/supprimer/", views.recette_delete, name="recette_delete"),
    path("recette/<int:pk>/reviews/", views.recette_reviews, name="recette_reviews"),
    path("recette/<int:pk>/reviews/<int:review_id>/supprimer/", views.recette_review_delete, name="recette_review_delete"),
    path("login/", views.login_view, name="login"),
    path("auth/callback/", views.auth_callback, name="auth_callback"),
    path("logout/", views.logout_view, name="logout"),
]