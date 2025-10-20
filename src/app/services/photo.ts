import { Injectable } from '@angular/core';
import { Camera, CameraResultType, CameraSource, Photo as CameraPhoto } from '@capacitor/camera';
import { Filesystem, Directory, Encoding } from '@capacitor/filesystem';
import { Preferences } from '@capacitor/preferences';
import { Geolocation } from '@capacitor/geolocation';


@Injectable({
  providedIn: 'root'
})
export class PhotoService {
  private PHOTO_STORAGE: string = 'photos';
  public photos: UserPhoto[] = [];

  constructor() {}

  // Convierte blob a base64
  private convertBlobToBase64 = (blob: Blob) => new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = reject;
    reader.onload = () => {
      resolve(reader.result);
    };
    reader.readAsDataURL(blob);
  });

  private async readAsBase64(photo: CameraPhoto) {
    const response = await fetch(photo.webPath!);
    const blob = await response.blob();
    return await this.convertBlobToBase64(blob) as string;
  }

  // Guarda la foto en el sistema de archivos
  private async savePicture(photo: CameraPhoto) {
    const base64Data = await this.readAsBase64(photo);
    const fileName = Date.now() + '.jpeg';
    await Filesystem.writeFile({
      path: fileName,
      data: base64Data,
      directory: Directory.Data
    });
    return {
      filepath: fileName,
      webviewPath: photo.webPath
    };
  }

  // Captura la foto y ubicación
  async addNewToGallery() {
    try {
    // Detectar si está en entorno web o nativo
    const isWeb = !('Capacitor' in window) || (window as any).Capacitor.getPlatform() === 'web';

    const capturedPhoto = await Camera.getPhoto({
      resultType: CameraResultType.Uri,
      // Si está en navegador → usa Prompt (para elegir cámara o archivo)
      // Si está en dispositivo → usa la cámara directamente
      source: isWeb ? CameraSource.Prompt : CameraSource.Camera,
      quality: 90,
    });

    const savedImageFile = await this.savePicture(capturedPhoto);

    // Obtener coordenadas
    const position = await Geolocation.getCurrentPosition();
    const latitude = position.coords.latitude;
    const longitude = position.coords.longitude;
    const mapsLink = `https://www.google.com/maps/@${latitude},${longitude}`;

    // Crear objeto foto con ubicación
    const photoWithLocation: UserPhoto = {
      ...savedImageFile,
      latitude,
      longitude,
      mapsLink
    };

    // Guardar en lista y almacenamiento local
    this.photos.unshift(photoWithLocation);
    await Preferences.set({
      key: this.PHOTO_STORAGE,
      value: JSON.stringify(this.photos),
    });

    // Guardar info en archivo de texto
    const info = `Foto: ${savedImageFile.filepath}\nUbicación: ${latitude}, ${longitude}\nLink: ${mapsLink}\n\n`;
    await Filesystem.appendFile({
      path: 'ubicaciones.txt',
      data: info,
      directory: Directory.Data,
      encoding: Encoding.UTF8,
    });

    console.log('✅ Foto y ubicación guardadas correctamente');
  } catch (error) {
    console.error('❌ Error al tomar la foto:', error);
  }
  }

  async loadSaved() {
    const { value } = await Preferences.get({ key: this.PHOTO_STORAGE });
    this.photos = (value ? JSON.parse(value) : []) as UserPhoto[];

    for (let photo of this.photos) {
      const readFile = await Filesystem.readFile({
        path: photo.filepath,
        directory: Directory.Data,
      });
      photo.webviewPath = `data:image/jpeg;base64,${readFile.data}`;
    }
  }
}
export interface UserPhoto {
  filepath: string;
  webviewPath?: string;
  latitude?: number;
  longitude?: number;
  mapsLink?: string;
}
