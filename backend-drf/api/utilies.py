import os
from django.conf import settings
import matplotlib.pyplot as plt

def save_img(filename):
    media_path = os.path.join(settings.MEDIA_ROOT, filename)

    # folder auto create (important)
    os.makedirs(settings.MEDIA_ROOT, exist_ok=True)

    plt.savefig(media_path)
    plt.close()

    # ✅ return correct URL
    return settings.MEDIA_URL + filename