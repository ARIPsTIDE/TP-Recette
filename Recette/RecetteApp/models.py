from django.db import models

# Create your models here.

class Recette(models.Model):
    
    CATEGORY_CHOICES = [
        ('entree', 'Entrée'),
        ('plat', 'Plat'),
        ('dessert', 'Dessert'),
        ('cocktail', 'Cocktail'),
    ]
    
    DIFFICULTY_CHOICES = [
        ('facile', 'Facile'),
        ('moyen', 'Moyen'),
        ('difficile', 'Difficile'),
    ]
    
    title = models.CharField(max_length=200)
    category = models.CharField(max_length=20, choices=CATEGORY_CHOICES)
    preparation_time = models.IntegerField(help_text="Temps en minutes")
    image = models.ImageField(upload_to='recipes/', blank=True, null=True)

    ingredients = models.TextField()
    steps = models.TextField()
    portions = models.IntegerField()
    difficulty = models.CharField(max_length=20, choices=DIFFICULTY_CHOICES)
    utensils = models.TextField()

    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return self.title