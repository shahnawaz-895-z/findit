import React, { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, Alert, Platform, Image, ScrollView, ActivityIndicator } from 'react-native';
import DateTimePicker from '@react-native-community/datetimepicker';
import * as ImagePicker from 'expo-image-picker';
import { Picker } from '@react-native-picker/picker';
import axios from 'axios';
import * as FileSystem from 'expo-file-system';
import { useNavigation } from '@react-navigation/native';

const ReportLostItem = () => {
  const navigation = useNavigation();
  const [time, setTime] = useState(new Date());
  const [contact, setContact] = useState('');
  const [category, setCategory] = useState('');
  const [date, setDate] = useState(new Date());
  const [description, setDescription] = useState('');
  const [location, setLocation] = useState('');
  const [photo, setPhoto] = useState(null);
  const [isLoading, setIsLoading] = useState(false);

  const [showDatePicker, setShowDatePicker] = useState(false);
  const [showTimePicker, setShowTimePicker] = useState(false);

  const categories = ['Electronics', 'Bags', 'Clothing', 'Accessories', 'Documents', 'Others'];
  const BACKEND_URL = 'http://192.168.0.114:5003'; 
  const HUGGING_FACE_API_KEY = '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'; // Replace with your API key

  const pickImage = async () => {
    const permissionResult = await ImagePicker.requestMediaLibraryPermissionsAsync();

    if (permissionResult.granted === false) {
      Alert.alert('Permission to access camera roll is required!');
      return;
    }

    let result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [4, 3],
      quality: 0.5,
      maxWidth: 1000,
      maxHeight: 1000,
    });

    if (!result.canceled && result.assets && result.assets.length > 0) {
      setPhoto(result.assets[0].uri);
      handleImageUpload(result.assets[0]);
    } else {
      Alert.alert('Image selection was cancelled or failed');
    }
  };

  const handleImageUpload = async (asset) => {
    if (!asset || !asset.uri) {
      console.error('No image asset provided');
      return;
    }

    setIsLoading(true);
    const huggingFaceUrl = 'https://api-inference.huggingface.co/models/Salesforce/blip-image-captioning-base';

    try {
      const base64ImageData = await FileSystem.readAsStringAsync(asset.uri, {
        encoding: FileSystem.EncodingType.Base64,
      });

      const result = await axios.post(huggingFaceUrl, { inputs: base64ImageData }, {
        headers: {
          'Authorization': `Bearer ${HUGGING_FACE_API_KEY}`,
          'Content-Type': 'application/json',
        },
      });

      if (result.data && result.data[0] && result.data[0].generated_text) {
        setDescription(result.data[0].generated_text);
      } else {
        setDescription('No description available');
      }
    } catch (error) {
      console.error('Error processing image:', error);
      Alert.alert('Error processing the image. Please try again.');
      setDescription('');
    } finally {
      setIsLoading(false);
    }
  };

  const handleSubmit = async () => {
    // Validation
    if (!description) {
      Alert.alert('Error', 'Please provide a description.');
      return;
    }
    if (!contact) {
      Alert.alert('Error', 'Please provide contact information.');
      return;
    }
    if (!category) {
      Alert.alert('Error', 'Please select a category.');
      return;
    }
    if (!location) {
      Alert.alert('Error', 'Please provide the location.');
      return;
    }

    setIsLoading(true);

    try {
      // Log the data being sent
      console.log('Submitting data:', {
        contact,
        category,
        location,
        description,
        time: time.toISOString(),
        date: date.toISOString(),
        hasPhoto: !!photo
      });

      const formData = new FormData();
      formData.append('contact', contact);
      formData.append('category', category);
      formData.append('location', location);
      formData.append('description', description);
      formData.append('time', time.toISOString());
      formData.append('date', date.toISOString());

      // Append photo if exists
      if (photo) {
        try {
          const filename = photo.split('/').pop();
          const match = /\.(\w+)$/.exec(filename);
          const type = match ? `image/${match[1]}` : 'image/jpeg';
          
          formData.append('photo', {
            uri: Platform.OS === 'ios' ? photo.replace('file://', '') : photo,
            name: filename || 'photo.jpg',
            type
          });
          console.log('Photo appended to form data');
        } catch (photoError) {
          console.error('Error preparing photo:', photoError);
        }
      }

      // Log the FormData entries
      for (let pair of formData.entries()) {
        console.log(pair[0], pair[1]);
      }

      // First, try using fetch
      console.log('Sending request to:', `${BACKEND_URL}/reportlost`);
      const response = await fetch(`${BACKEND_URL}/reportlost`, {
        method: 'POST',
        body: formData,
        headers: {
          'Accept': 'application/json',
          'Content-Type': 'multipart/form-data',
        },
      });

      console.log('Response status:', response.status);
      const responseData = await response.json();
      console.log('Response data:', responseData);

      if (response.ok) {
        Alert.alert('Success', 'Report submitted successfully!');
        // Reset form
        setContact('');
        setCategory('');
        setLocation('');
        setDescription('');
        setPhoto(null);
        setTime(new Date());
        setDate(new Date());
      } else {
        throw new Error(responseData.message || 'Server returned an error');
      }
    } catch (error) {
      console.error('Detailed error:', error);
      
      // More detailed error alert
      Alert.alert(
        'Error',
        `Faileds to submit report: ${error.message}\n\nPlease check your connection and try again.`,
        [
          { text: 'OK' },
          { 
            text: 'Show Details', 
            onPress: () => console.log('Full error:', error)
          }
        ]
      );
    } finally {
      setIsLoading(false);
    }
  };

  const onChangeDate = (event, selectedDate) => {
    const currentDate = selectedDate || date;
    setShowDatePicker(Platform.OS === 'ios');
    setDate(currentDate);
  };

  const onChangeTime = (event, selectedTime) => {
    const currentTime = selectedTime || time;
    setShowTimePicker(Platform.OS === 'ios');
    setTime(currentTime);
  };

  const handleNoPicture = () => {
    navigation.navigate('ReportLostItemWithPic');
  };
  
  return (
    <ScrollView style={styles.container}>
      <Text style={styles.title}>Report Lost Item</Text>

      <TouchableOpacity style={styles.noPictureButton} onPress={handleNoPicture}>
        <Text style={styles.noPictureButtonText}>No Picture? Report Lost Item</Text>
      </TouchableOpacity>

      <Text style={styles.label}>Time:</Text>
      <TouchableOpacity style={styles.input} onPress={() => setShowTimePicker(true)}>
        <Text>{time.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</Text>
      </TouchableOpacity>
      {showTimePicker && (
        <DateTimePicker
          value={time}
          mode="time"
          is24Hour={true}
          display="default"
          onChange={onChangeTime}
        />
      )}

      <Text style={styles.label}>Contact:</Text>
      <TextInput
        style={styles.input}
        placeholder="Enter contact number"
        keyboardType="numeric"
        value={contact}
        onChangeText={setContact}
      />

      <Text style={styles.label}>Category:</Text>
      <View style={styles.pickerContainer}>
        <Picker
          selectedValue={category}
          onValueChange={(itemValue) => setCategory(itemValue)}
          style={styles.picker}
        >
          <Picker.Item label="Select Category" value="" />
          {categories.map((item, index) => (
            <Picker.Item key={index} label={item} value={item} />
          ))}
        </Picker>
      </View>

      <Text style={styles.label}>Date:</Text>
      <TouchableOpacity style={styles.input} onPress={() => setShowDatePicker(true)}>
        <Text>{date.toDateString()}</Text>
      </TouchableOpacity>
      {showDatePicker && (
        <DateTimePicker
          value={date}
          mode="date"
          display="default"
          onChange={onChangeDate}
        />
      )}

      <Text style={styles.label}>Location:</Text>
      <TextInput
        style={styles.input}
        placeholder="Enter location"
        value={location}
        onChangeText={setLocation}
      />

      <Text style={styles.label}>Upload Photo:</Text>
      <TouchableOpacity onPress={pickImage} style={styles.uploadButton}>
        <Text style={styles.uploadText}>Upload Photo</Text>
      </TouchableOpacity>
      {photo && (
        <View style={styles.imageContainer}>
          <Image source={{ uri: photo }} style={styles.image} />
          <Text style={styles.uploadText}>Photo selected</Text>
        </View>
      )}

      <Text style={styles.label}>Description:</Text>
      {isLoading ? (
        <ActivityIndicator size="large" color="#4a148c" />
      ) : (
        <TextInput
          style={[styles.input, styles.descriptionInput]}
          placeholder="Enter description"
          value={description}
          onChangeText={setDescription}
          multiline
          editable={!isLoading}
        />
      )}

      <TouchableOpacity style={styles.submitButton} onPress={handleSubmit}>
        <Text style={styles.submitButtonText}>SUBMIT</Text>
      </TouchableOpacity>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 20,
    backgroundColor: '#fff',
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    textAlign: 'center',
    marginVertical: 20,
  },
  label: {
    fontSize: 16,
    marginVertical: 5,
    fontWeight: 'bold',
  },
  input: {
    height: 40,
    borderColor: '#ccc',
    borderWidth: 1,
    borderRadius: 5,
    paddingHorizontal: 10,
    marginBottom: 15,
    justifyContent: 'center',
  },
  pickerContainer: {
    borderColor: '#ccc',
    borderWidth: 1,
    borderRadius: 5,
    marginBottom: 15,
    justifyContent: 'center',
  },
  picker: {
    height: 40,
  },
  uploadButton: {
    backgroundColor: '#f0f0f0',
    padding: 10,
    borderRadius: 5,
    alignItems: 'center',
    marginBottom: 15,
  },
  uploadText: {
    fontSize: 16,
    textAlign: 'center',
    marginTop: 5,
  },
  imageContainer: {
    alignItems: 'center',
    marginBottom: 15,
  },
  image: {
    width: 200,
    height: 200,
    resizeMode: 'contain',
  },
  descriptionInput: {
    height: 100,
    textAlignVertical: 'top',
  },
  submitButton: {
    backgroundColor: '#4a148c',
    padding: 15,
    borderRadius: 5,
    alignItems: 'center',
    marginTop: 20,
    marginBottom: 30,
  },
  submitButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
  noPictureButton: {
    backgroundColor: '#0056b3',
    padding: 15,
    borderRadius: 5,
    alignItems: 'center',
    marginBottom: 20,
  },
  noPictureButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
});

export default ReportLostItem;