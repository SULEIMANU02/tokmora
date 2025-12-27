import React, { useContext } from "react";
import { NavigationContainer } from '@react-navigation/native';
import { StyleSheet, View } from "react-native";
import HomeScreen from "./Screens/HomeScreen";
import WhatsappStatusScreen from "./Screens/WhatsappStatusScreen";
import DownloadsScreen from "./Screens/DownloadsScreen";
import UserNavigation from "./components/UserNavigation";

function App() {

  return (
  
    <View
      style={{
        ...styles.container,
        backgroundColor: "#6a5acd",
      }}
    >
      <UserNavigation />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    marginTop: 0,
  },
});

export default () => {
  return (
    <NavigationContainer>
         <App />
    </NavigationContainer>

  );
};


